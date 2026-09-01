const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Customer = require('../models/Customer');
const Loan = require('../models/Loan');
const Payment = require('../models/Payment');
const StockTransaction = require('../models/StockTransaction');
const Expense = require('../models/Expense');
const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');
const User = require('../models/User');
const Order = require('../models/Order');
const { wrapAsync } = require('../middleware/errorHandler');

const dateRange = (q) => {
  const range = {};
  if (q.from) range.$gte = new Date(q.from);
  if (q.to) range.$lte = new Date(`${q.to}T23:59:59.999Z`);
  return Object.keys(range).length ? range : null;
};

/** GET /api/reports/sales?period=day|week|month|year|custom&from&to */
exports.salesReport = wrapAsync(async (req, res) => {
  const now = new Date();
  let from;
  switch (req.query.period) {
    case 'today': case 'day': from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'week': from = new Date(Date.now() - 7 * 86400000); break;
    case 'month': from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'year': from = new Date(now.getFullYear(), 0, 1); break;
    default: from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : now;
  const match = { status: 'COMPLETED', createdAt: { $gte: from, $lte: to } };

  const [summary] = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        revenue: { $sum: '$total' },
        received: { $sum: '$amountPaid' },
        outstanding: { $sum: '$balance' },
        discounts: { $sum: '$discount' }
      }
    }
  ]);

  const byDay = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' }, received: { $sum: '$amountPaid' }, count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const byCashier = await Sale.aggregate([
    { $match: match },
    { $group: { _id: '$cashier', revenue: { $sum: '$total' }, count: { $sum: 1 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { name: '$user.fullName', revenue: 1, count: 1 } },
    { $sort: { revenue: -1 } }
  ]);

  const byMethod = await Sale.aggregate([
    { $match: match },
    { $group: { _id: '$paymentMethod', total: { $sum: '$total' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);

  const topProducts = await Sale.aggregate([
    { $match: match },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', name: { $first: '$items.productName' }, qtySold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.subtotal' } } },
    { $sort: { qtySold: -1 } },
    { $limit: 10 }
  ]);

  const byCategory = await Sale.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products', localField: 'items.product', foreignField: '_id', as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $lookup: {
        from: 'categories', localField: 'product.category', foreignField: '_id', as: 'category'
      }
    },
    { $unwind: '$category' },
    { $group: { _id: '$category.name', revenue: { $sum: '$items.subtotal' }, qtySold: { $sum: '$items.quantity' } } },
    { $sort: { revenue: -1 } }
  ]);

  res.json({
    success: true,
    data: {
      period: { from, to },
      summary: summary || { count: 0, revenue: 0, received: 0, outstanding: 0, discounts: 0 },
      byDay, byCashier, byMethod, topProducts, byCategory
    }
  });
});

/** GET /api/reports/stock */
exports.stockReport = wrapAsync(async (req, res) => {
  const [currentStock, valuation] = await Promise.all([
    Product.find({ status: 'ACTIVE' }).populate('category', 'name').sort({ quantity: -1 }),
    Product.aggregate([
      { $match: { status: 'ACTIVE' } },
      {
        $group: {
          _id: null,
          stockValueCost: { $sum: { $multiply: ['$quantity', '$buyingPrice'] } },
          stockValueRetail: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
          totalUnits: { $sum: '$quantity' }
        }
      }
    ])
  ]);

  const range = dateRange(req.query);
  const txMatch = range ? { createdAt: range } : {};
  const movementsByType = await StockTransaction.aggregate([
    { $match: txMatch },
    { $group: { _id: '$type', count: { $sum: 1 }, unitsIn: { $sum: { $cond: [{ $gt: ['$newQuantity', '$previousQuantity'] }, '$quantity', 0] } } } }
  ]);

  const lowStock = currentStock.filter((p) => p.quantity > 0 && p.quantity <= p.minStockLevel).slice(0, 100);
  const outOfStock = currentStock.filter((p) => p.quantity === 0).slice(0, 100);

  res.json({
    success: true,
    data: {
      products: currentStock,
      valuation: valuation[0] || { stockValueCost: 0, stockValueRetail: 0, totalUnits: 0 },
      movementsByType, lowStock, outOfStock
    }
  });
});

/** GET /api/reports/customers */
exports.customersReport = wrapAsync(async (req, res) => {
  const topCustomers = await Customer.find().sort({ totalPurchases: -1 }).limit(10)
    .select('name phone totalPurchases totalPaid outstandingBalance');

  const withDebt = await Customer.find({ outstandingBalance: { $gt: 0 } }).sort({ outstandingBalance: -1 })
    .select('name phone outstandingBalance');

  const [stats] = await Customer.aggregate([
    { $group: { _id: null, total: { $sum: 1 }, withDebtCount: { $sum: { $cond: [{ $gt: ['$outstandingBalance', 0] }, 1, 0] } }, totalDebt: { $sum: '$outstandingBalance' } } }
  ]);

  res.json({
    success: true,
    data: {
      topCustomers,
      customersWithDebt: withDebt,
      stats: stats || { total: 0, withDebtCount: 0, totalDebt: 0 }
    }
  });
});

/** GET /api/reports/loans */
exports.loansReport = wrapAsync(async (req, res) => {
  await Loan.updateMany(
    { dueDate: { $lt: new Date() }, status: { $in: ['ACTIVE', 'PARTIALLY_PAID'] } },
    { $set: { status: 'OVERDUE' } }
  );

  const [byStatus, overdueLoans, repaymentTrend] = await Promise.all([
    Loan.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$outstandingBalance' } } }
    ]),
    Loan.find({ status: 'OVERDUE' }).sort({ dueDate: 1 }).select('loanNumber customerName customerPhone outstandingBalance dueDate'),
    Payment.aggregate([
      { $match: { type: 'LOAN_REPAYMENT' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  const totals = byStatus.reduce(
    (acc, s) => {
      acc.totalGiven += s._id !== 'CANCELLED' ? 0 : 0; // computed below
      return acc;
    },
    { totalGiven: 0, totalOutstanding: 0, totalRepaid: 0 }
  );
  const [agg] = await Loan.aggregate([{
    $group: {
      _id: null,
      totalGiven: { $sum: '$totalAmount' },
      totalRepaid: { $sum: '$amountPaid' },
      totalOutstanding: { $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$outstandingBalance', 0] } }
    }
  }]);

  res.json({
    success: true,
    data: {
      byStatus,
      overdueLoans,
      repaymentTrend,
      totals: agg || totals
    }
  });
});

/** GET /api/reports/financial */
exports.financialReport = wrapAsync(async (req, res) => {
  const range = dateRange(req.query) ? { createdAt: dateRange(req.query), status: 'COMPLETED' } : { status: 'COMPLETED' };

  const [salesAgg] = await Sale.aggregate([
    { $match: range },
    { $group: { _id: null, totalSales: { $sum: '$total' }, totalPaid: { $sum: '$amountPaid' }, totalDiscounts: { $sum: '$discount' }, salesCount: { $sum: 1 } } }
  ]);

  // Gross profit: sale price vs buying price where cost is known
  const profitAgg = await Sale.aggregate([
    { $match: range },
    { $unwind: '$items' },
    {
      $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'product' }
    },
    { $unwind: '$product' },
    {
      $project: {
        cost: { $multiply: ['$product.buyingPrice', '$items.quantity'] },
        revenue: '$items.subtotal'
      }
    },
    { $group: { _id: null, cost: { $sum: '$cost' }, revenue: { $sum: '$revenue' } } }
  ]);

  const [loanAgg] = await Loan.aggregate([
    { $match: {} },
    { $group: { _id: null, creditGiven: { $sum: '$totalAmount' }, creditRepaid: { $sum: '$amountPaid' }, creditOutstanding: { $sum: { $cond: [{ $ne: ['$status', 'CANCELLED'] }, '$outstandingBalance', 0] } } } }
  ]);

  const paymentsByMethod = await Payment.aggregate([
    { $match: range.createdAt ? range : {} },
    { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  // Expenses for the same period
  const expRange = dateRange(req.query) ? { date: dateRange(req.query) } : {};
  const [expenseAgg] = await Expense.aggregate([
    { $match: expRange },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  // Purchases for the period (inventory/materials acquired - NOT operating expenses)
  const [purchaseAgg] = await Purchase.aggregate([
    { $match: dateRange(req.query) ? { createdAt: dateRange(req.query) } : {} },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, paid: { $sum: '$amountPaid' }, remaining: { $sum: '$remainingAmount' } } }
  ]);

  // Supplier payments
  const [supplierPaymentAgg] = await SupplierPayment.aggregate([
    { $match: dateRange(req.query) ? { createdAt: dateRange(req.query) } : {} },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  const costOfGoodsSold = profitAgg[0]?.cost || 0;
  const revenue = salesAgg?.totalSales || 0;
  const grossProfit = Math.max(0, revenue - costOfGoodsSold);
  const operatingExpenses = expenseAgg?.total || 0;
  const netProfit = grossProfit - operatingExpenses;

  res.json({
    success: true,
    data: {
      sales: salesAgg || { totalSales: 0, totalPaid: 0, totalDiscounts: 0, salesCount: 0 },
      grossProfit,
      costOfGoodsSold,
      operatingExpenses,
      netProfit,
      loans: loanAgg || { creditGiven: 0, creditRepaid: 0, creditOutstanding: 0 },
      paymentsByMethod,
      expenses: expenseAgg || { total: 0, count: 0 },
      purchases: purchaseAgg || { total: 0, paid: 0, remaining: 0 },
      supplierPayments: supplierPaymentAgg || { total: 0, count: 0 }
    }
  });
});

/** GET /api/reports/expenses */
exports.expenseReport = wrapAsync(async (req, res) => {
  const range = dateRange(req.query) ? { date: dateRange(req.query) } : {};

  const [summary] = await Expense.aggregate([
    { $match: range },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  const byCategory = await Expense.aggregate([
    { $match: range },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);

  const byUser = await Expense.aggregate([
    { $match: range },
    { $group: { _id: '$createdBy', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 1, total: 1, count: 1, name: '$user.fullName' } },
    { $sort: { total: -1 } }
  ]);

  const byDay = await Expense.aggregate([
    { $match: range },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: {
      summary: summary || { total: 0, count: 0 },
      byCategory, byUser, byDay
    }
  });
});

/** GET /api/reports/purchases */
exports.purchaseReport = wrapAsync(async (req, res) => {
  const range = dateRange(req.query) ? { createdAt: dateRange(req.query) } : {};

  const [summary] = await Purchase.aggregate([
    { $match: range },
    {
      $group: {
        _id: null,
        total: { $sum: '$totalAmount' },
        paid: { $sum: '$amountPaid' },
        remaining: { $sum: '$remainingAmount' },
        count: { $sum: 1 },
        cashPurchases: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, '$totalAmount', 0] } },
        creditPurchases: { $sum: { $cond: [{ $in: ['$paymentStatus', ['UNPAID', 'PARTIALLY_PAID']] }, '$remainingAmount', 0] } }
      }
    }
  ]);

  const [supplierPaymentAgg] = await SupplierPayment.aggregate([
    { $match: range },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);

  const byStatus = await Purchase.aggregate([
    { $match: range },
    { $group: { _id: '$paymentStatus', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
  ]);

  const bySupplier = await Purchase.aggregate([
    { $match: range },
    { $group: { _id: '$supplier', total: { $sum: '$totalAmount' }, remaining: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
    { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 'supplier' } },
    { $unwind: '$supplier' },
    { $project: { _id: 1, total: 1, remaining: 1, count: 1, name: '$supplier.name' } },
    { $sort: { total: -1 } }
  ]);

  const overdue = await Purchase.aggregate([
    { $match: { ...range, paymentStatus: { $in: ['UNPAID', 'PARTIALLY_PAID'] }, dueDate: { $lt: new Date() } } },
    { $group: { _id: null, total: { $sum: '$remainingAmount' }, count: { $sum: 1 } } }
  ]);

  res.json({
    success: true,
    data: {
      summary: summary || { total: 0, paid: 0, remaining: 0, count: 0, cashPurchases: 0, creditPurchases: 0 },
      supplierPayments: supplierPaymentAgg || { total: 0, count: 0 },
      byStatus, bySupplier,
      overdue: overdue[0] || { total: 0, count: 0 }
    }
  });
});

/** GET /api/reports/user-performance */
exports.userPerformanceReport = wrapAsync(async (req, res) => {
  const range = dateRange(req.query) ? { createdAt: dateRange(req.query) } : {};
  const rangeDate = dateRange(req.query) ? { date: dateRange(req.query) } : {};

  const salesByUser = await Sale.aggregate([
    { $match: { ...range, status: 'COMPLETED' } },
    { $group: { _id: '$cashier', count: { $sum: 1 }, total: { $sum: '$total' } } }
  ]);
  const ordersByUser = await Order.aggregate([
    { $match: range },
    { $group: { _id: '$createdBy', count: { $sum: 1 } } }
  ]);
  const expensesByUser = await Expense.aggregate([
    { $match: rangeDate },
    { $group: { _id: '$createdBy', count: { $sum: 1 }, total: { $sum: '$amount' } } }
  ]);
  const purchasesByUser = await Purchase.aggregate([
    { $match: range },
    { $group: { _id: '$createdBy', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } }
  ]);

  const users = await User.find({ isActive: true }).select('fullName');

  const map = {};
  for (const u of users) map[u._id.toString()] = { user: u.fullName, orders: 0, sales: 0, expenses: 0, purchases: 0, transactionValue: 0 };
  for (const x of salesByUser) if (map[x._id?.toString()]) { map[x._id.toString()].sales = x.count; map[x._id.toString()].transactionValue += x.total; }
  for (const x of ordersByUser) if (map[x._id?.toString()]) map[x._id.toString()].orders = x.count;
  for (const x of expensesByUser) if (map[x._id?.toString()]) { map[x._id.toString()].expenses = x.count; map[x._id.toString()].transactionValue += x.total; }
  for (const x of purchasesByUser) if (map[x._id?.toString()]) { map[x._id.toString()].purchases = x.count; map[x._id.toString()].transactionValue += x.total; }

  res.json({
    success: true,
    data: {
      users: Object.values(map).sort((a, b) => b.transactionValue - a.transactionValue)
    }
  });
});
