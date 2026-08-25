const mongoose = require('mongoose');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sale = require('../models/Sale');
const Order = require('../models/Order');
const Loan = require('../models/Loan');
const StockTransaction = require('../models/StockTransaction');
const { wrapAsync } = require('../middleware/errorHandler');

const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

exports.overview = wrapAsync(async (req, res) => {
  await Loan.updateMany(
    { dueDate: { $lt: new Date() }, status: { $in: ['ACTIVE', 'PARTIALLY_PAID'] } },
    { $set: { status: 'OVERDUE' } }
  );

  const today = startOfDay();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalProducts,
    activeProducts,
    totalStockQty,
    totalCustomers,
    totalSuppliers,
    todaySalesAgg,
    monthSalesAgg,
    pendingOrders,
    loanAgg,
    lowStockCount,
    outOfStockCount
  ] = await Promise.all([
    Product.countDocuments({ status: 'ACTIVE' }),
    Product.countDocuments({}),
    Product.aggregate([{ $match: { status: 'ACTIVE' } }, { $group: { _id: null, qty: { $sum: '$quantity' } } }]),
    Customer.countDocuments({ status: 'ACTIVE' }),
    Supplier.countDocuments({ status: 'ACTIVE' }),
    Sale.aggregate([
      { $match: { createdAt: { $gte: today }, status: 'COMPLETED' } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' }, received: { $sum: '$amountPaid' } } }
    ]),
    Sale.aggregate([
      { $match: { createdAt: { $gte: monthStart }, status: 'COMPLETED' } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$total' } } }
    ]),
    Order.countDocuments({ status: 'PENDING' }),
    Loan.aggregate([
      { $match: { status: { $in: ['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE'] } } },
      { $group: { _id: null, outstanding: { $sum: '$outstandingBalance' }, count: { $sum: 1 }, overdueAmount: { $sum: { $cond: [{ $eq: ['$status', 'OVERDUE'] }, '$outstandingBalance', 0] } } } }
    ]),
    Product.countDocuments({ status: 'ACTIVE', quantity: { $gt: 0 }, $expr: { $lte: ['$quantity', '$minStockLevel'] } }),
    Product.countDocuments({ status: 'ACTIVE', quantity: 0 })
  ]);

  // Payment method breakdown for today
  const todayPayments = await Sale.aggregate([
    { $match: { createdAt: { $gte: today }, status: 'COMPLETED' } },
    {
      $project: {
        cash: { $cond: [{ $eq: ['$paymentMethod', 'CASH'] }, '$total', 0] },
        momo: { $cond: [{ $eq: ['$paymentMethod', 'MOMO'] }, '$total', 0] },
        bank: { $cond: [{ $eq: ['$paymentMethod', 'BANK'] }, '$total', 0] },
        credit: { $add: ['$balance', { $cond: [{ $ne: ['$paymentMethod', 'LOAN'] }, 0, 0] }] },
        balance: '$balance'
      }
    },
    {
      $group: {
        _id: null,
        cash: { $sum: '$cash' },
        momo: { $sum: '$momo' },
        bank: { $sum: '$bank' },
        credit: { $sum: '$balance' }
      }
    }
  ]);

  // Sales trend last 7 days
  const trend = await Sale.aggregate([
    { $match: { createdAt: { $gte: daysAgo(6) }, status: 'COMPLETED' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const [recentTransactions, recentSales, lowStockProducts, outOfStockProducts, topDebtors] = await Promise.all([
    StockTransaction.find().sort({ createdAt: -1 }).limit(10)
      .populate('product', 'name').populate('performedBy', 'fullName'),
    Sale.find({ status: 'COMPLETED' }).sort({ createdAt: -1 }).limit(10).populate('customer', 'name phone'),
    Product.find({ status: 'ACTIVE', quantity: { $gt: 0 }, $expr: { $lte: ['$quantity', '$minStockLevel'] } })
      .sort({ quantity: 1 }).limit(8).select('name sku quantity minStockLevel unit'),
    Product.find({ status: 'ACTIVE', quantity: 0 }).limit(8).select('name sku minStockLevel unit'),
    Loan.find({ status: { $in: ['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE'] } }).sort({ outstandingBalance: -1 }).limit(8)
      .select('customerName customerPhone outstandingBalance dueDate status loanNumber')
  ]);

  res.json({
    success: true,
    data: {
      cards: {
        totalProducts,
        totalStockQty: totalStockQty[0]?.qty || 0,
        totalCustomers,
        totalSuppliers,
        todaySalesCount: todaySalesAgg[0]?.count || 0,
        todayRevenue: todaySalesAgg[0]?.revenue || 0,
        todayReceived: todaySalesAgg[0]?.received || 0,
        monthRevenue: monthSalesAgg[0]?.revenue || 0,
        monthSalesCount: monthSalesAgg[0]?.count || 0,
        pendingOrders,
        outstandingLoansTotal: loanAgg[0]?.outstanding || 0,
        outstandingLoansCount: loanAgg[0]?.count || 0,
        overdueLoansAmount: loanAgg[0]?.overdueAmount || 0,
        lowStockCount,
        outOfStockCount
      },
      todayByMethod: todayPayments[0] || { cash: 0, momo: 0, bank: 0, credit: 0 },
      salesTrend: trend,
      recentTransactions,
      recentSales,
      lowStockProducts,
      outOfStockProducts,
      topDebtors
    }
  });
});
