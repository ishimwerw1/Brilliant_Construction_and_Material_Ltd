const mongoose = require('mongoose');
const OnDemand = require('../models/OnDemand');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const SupplierPayment = require('../models/SupplierPayment');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');
const { nextSequence } = require('../utils/generateCode');
const { applyStockMovement } = require('./stockService');
const { notify } = require('./notificationService');
const { logAction, ACTIONS } = require('./auditService');

const computeStatus = (total, paid) => {
  if (paid <= 0) return 'UNPAID';
  if (paid >= total - 0.001) return 'PAID';
  return 'PARTIALLY_PAID';
};

const round2 = (n) => Math.round(n * 100) / 100;

const recomputeSupplierAggregates = (onDemand) => {
  if (onDemand.supplierDetails && onDemand.supplierDetails.length) {
    onDemand.supplierCost = round2(onDemand.supplierDetails.reduce((s, d) => s + d.totalCost, 0));
    onDemand.supplierPaid = round2(onDemand.supplierDetails.reduce((s, d) => s + d.amountPaid, 0));
    onDemand.supplierBalance = round2(onDemand.supplierDetails.reduce((s, d) => s + d.balance, 0));
    onDemand.supplierPaymentStatus = computeStatus(onDemand.supplierCost, onDemand.supplierPaid);
  }
};

/** Resolves per-item suppliers, snapshots items and groups them by supplier. */
const buildItemSnapshots = async ({ items, fallbackSupplierId, session }) => {
  const itemSnapshots = [];
  const supplierCache = new Map();
  const supplierGroups = new Map();
  const orderedSuppliers = [];

  const getSupplier = async (id) => {
    const key = String(id);
    if (supplierCache.has(key)) return supplierCache.get(key);
    const supplier = await Supplier.findById(id).session(session);
    if (!supplier) throw new ApiError(400, `Supplier not found for id ${id}.`);
    supplierCache.set(key, supplier);
    if (!supplierGroups.has(key)) {
      supplierGroups.set(key, { supplier: supplier._id, supplierName: supplier.name, items: [], totalCost: 0 });
      orderedSuppliers.push(supplier);
    }
    return supplier;
  };

  for (const item of items) {
    const product = item.product ? await Product.findById(item.product).session(session) : null;
    const productName = item.productName?.trim() || product?.name;
    if (!productName) throw new ApiError(400, 'Each on-demand item needs a product name.');
    const qty = Number(item.quantity);
    if (!qty || qty <= 0) throw new ApiError(400, `Invalid quantity for "${productName}".`);
    const supplierCost = Number(item.supplierCostPrice ?? item.costPrice);
    if (!Number.isFinite(supplierCost) || supplierCost < 0) {
      throw new ApiError(400, `Invalid supplier cost for "${productName}".`);
    }
    const sellingPrice = Number(item.sellingPrice ?? item.unitPrice ?? product?.sellingPrice);
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      throw new ApiError(400, `Invalid selling price for "${productName}".`);
    }
    const sid = item.supplier || item.supplierId || fallbackSupplierId;
    if (!sid) throw new ApiError(400, `A supplier is required for "${productName}".`);
    const supplier = await getSupplier(sid);

    const totalCost = round2(qty * supplierCost);
    const totalRevenue = round2(qty * sellingPrice);
    const snap = {
      product: product?._id,
      productName,
      quantity: qty,
      supplierCostPrice: supplierCost,
      sellingPrice,
      totalCost,
      totalRevenue,
      profit: round2(totalRevenue - totalCost),
      supplier: supplier._id,
      supplierName: supplier.name
    };
    itemSnapshots.push(snap);
    const group = supplierGroups.get(String(supplier._id));
    group.items.push(snap);
    group.totalCost = round2(group.totalCost + snap.totalCost);
  }

  return { itemSnapshots, supplierGroups, orderedSuppliers };
};

/**
 * Creates an On-Demand Sale atomically.
 *
 * The flow: Customer -> On-Demand Sale -> Supplier purchase -> Supplier cost.
 * - Sells products bought specifically for that customer (not from our own stock).
 * - Records BOTH the customer sale and the supplier purchase.
 * - Profit uses the ACTUAL supplier purchase cost, never the product default price.
 */
const createOnDemand = async ({ payload, user }) => {
  const settings = await Setting.getSettings();
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const {
        customerId,
        customerName,
        customerPhone,
        items,
        supplierId,
        supplierPayments = [],
        amountPaid = 0,
        paymentMethod = 'CASH',
        paymentReference,
        dueDate,
        notes
      } = payload;

      if (!Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'On-Demand sale must contain at least one product.');
      }

      const customer = await resolveCustomer({ customerId, name: customerName, phone: customerPhone, session });
      const { itemSnapshots, supplierGroups, orderedSuppliers } = await buildItemSnapshots({ items, fallbackSupplierId: supplierId, session });

      const totalCost = round2(itemSnapshots.reduce((s, i) => s + i.totalCost, 0));
      const totalAmount = round2(itemSnapshots.reduce((s, i) => s + i.totalRevenue, 0));
      const totalProfit = round2(totalAmount - totalCost);

      // Resolve initial payments per supplier.
      const initialPayments = new Map();
      for (const sp of supplierPayments || []) {
        const sid = sp && sp.supplier ? String(sp.supplier) : null;
        const amt = Math.max(0, Number(sp.amount) || 0);
        if (sid && amt > 0) initialPayments.set(sid, amt);
      }
      const paidBySupplier = new Map();
      for (const [key, g] of supplierGroups) {
        const supPaid = initialPayments.get(key) || 0;
        if (supPaid > g.totalCost + 0.001) {
          throw new ApiError(400, `Supplier payment for ${g.supplierName} exceeds its purchase cost of ${g.totalCost.toLocaleString()} RWF.`);
        }
        paidBySupplier.set(key, { paid: supPaid, balance: round2(g.totalCost - supPaid) });
      }
      const supplierPaidOk = round2([...paidBySupplier.values()].reduce((s, p) => s + p.paid, 0));
      const supplierBalance = round2([...paidBySupplier.values()].reduce((s, p) => s + p.balance, 0));

      const paid = Math.max(0, Number(amountPaid) || 0);
      if (paid > totalAmount) throw new ApiError(400, 'Customer payment cannot exceed the sale total.');
      const balance = round2(Math.max(0, totalAmount - paid));

      const transactionNumber = await nextSequence('onDemandNumber', 'OND', session);
      const saleNumber = await nextSequence('saleNumber', 'INV', session);

      const supplierNames = orderedSuppliers.map((s) => s.name);
      const supplierLabel = supplierNames.join(', ');

      // 1. The On-Demand master record (customer {->} supplier(s) {->} cost {->} sale).
      const [onDemand] = await OnDemand.create(
        [
          {
            transactionNumber,
            customer: customer._id,
            customerName: customer.name,
            customerPhone: customer.phone,
            items: itemSnapshots,
            supplierDetails: orderedSuppliers.map((s) => {
              const group = supplierGroups.get(String(s._id));
              const { paid: supPaid, balance: supBalance } = paidBySupplier.get(String(s._id));
              return {
                supplier: s._id,
                supplierName: s.name,
                totalCost: group.totalCost,
                amountPaid: supPaid,
                balance: supBalance,
                paymentStatus: computeStatus(group.totalCost, supPaid)
              };
            }),
            supplier: orderedSuppliers[0]._id,
            supplierName: supplierLabel,
            supplierCost: totalCost,
            customerSellingPrice: totalAmount,
            totalAmount,
            totalCost,
            totalProfit,
            amountPaid: paid,
            balance,
            supplierPaid: supplierPaidOk,
            supplierBalance,
            paymentMethod,
            paymentStatus: computeStatus(totalAmount, paid),
            supplierPaymentStatus: computeStatus(totalCost, supplierPaidOk),
            status: balance > 0 || supplierBalance > 0 ? 'ACTIVE' : 'COMPLETED',
            notes,
            createdBy: user._id
          }
        ],
        { session }
      );

      // 2. The sale (revenue side) with actual supplier cost snapshotted as cost.
      const saleType = 'ON_DEMAND';
      const effectivePaymentMethod = balance > 0 ? (paymentMethod === 'LOAN' ? 'LOAN' : 'MIXED') : paymentMethod;
      const [sale] = await Sale.create(
        [
          {
            saleNumber,
            customer: customer._id,
            customerName: customer.name,
            items: itemSnapshots.map((i) => ({
              product: i.product,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.sellingPrice,
              discount: 0,
              subtotal: i.totalRevenue,
              costPriceAtSale: i.supplierCostPrice,
              sellingPriceAtSale: i.sellingPrice,
              totalCost: i.totalCost,
              totalRevenue: i.totalRevenue,
              profit: i.profit
            })),
            subtotal: totalAmount,
            discount: 0,
            total: totalAmount,
            totalCost,
            totalProfit,
            amountPaid: paid,
            balance,
            paymentMethod: effectivePaymentMethod,
            paymentStatus: computeStatus(totalAmount, paid),
            saleType,
            paymentReference,
            cashier: user._id,
            onDemand: onDemand._id,
            notes: `On-demand purchase from ${supplierLabel} (${transactionNumber})`
          }
        ],
        { session }
      );

      // 3. One supplier purchase + payment per supplier (no stock movement - goods go directly to the customer).
      let firstPurchaseId = null;
      const purchases = [];
      for (const s of orderedSuppliers) {
        const key = String(s._id);
        const group = supplierGroups.get(key);
        const { paid: supPaid } = paidBySupplier.get(key);
        const purchaseNumber = await nextSequence('purchase', 'PUR', session);
        const [purchase] = await Purchase.create(
          [
            {
              purchaseNumber,
              supplier: s._id,
              supplierName: s.name,
              items: group.items.map((i) => ({
                product: i.product,
                productName: i.productName,
                quantity: i.quantity,
                costPrice: i.supplierCostPrice,
                subtotal: i.totalCost
              })),
              totalAmount: group.totalCost,
              paymentMethod: paymentMethod === 'LOAN' || paymentMethod === 'CREDIT' ? 'CASH' : paymentMethod,
              paymentStatus: computeStatus(group.totalCost, supPaid),
              amountPaid: supPaid,
              remainingAmount: round2(group.totalCost - supPaid),
              onDemand: onDemand._id,
              onDemandNumber: transactionNumber,
              notes: `On-demand for customer ${customer.name} (${transactionNumber}) - direct supplier purchase from ${s.name}`,
              createdBy: user._id
            }
          ],
          { session }
        );
        if (!firstPurchaseId) firstPurchaseId = purchase._id;
        purchases.push(purchase);

        const entry = onDemand.supplierDetails.find((d) => String(d.supplier) === String(s._id));
        if (entry) entry.purchase = purchase._id;

        if (supPaid > 0) {
          const spNumber = await nextSequence('supplierPayment', 'SP', session);
          await SupplierPayment.create(
            [
              {
                paymentNumber: spNumber,
                purchase: purchase._id,
                supplier: s._id,
                amount: supPaid,
                paymentMethod: paymentMethod === 'LOAN' || paymentMethod === 'CREDIT' ? 'CASH' : paymentMethod,
                notes: `On-demand payment for ${transactionNumber} (${s.name})`,
                createdBy: user._id
              }
            ],
            { session }
          );
          if (entry) {
            entry.payments.push({
              paymentNumber: spNumber,
              amount: supPaid,
              method: paymentMethod === 'LOAN' || paymentMethod === 'CREDIT' ? 'CASH' : paymentMethod,
              receivedBy: user._id
            });
          }
        }
      }

      // 4. Customer payment record.
      if (paid > 0) {
        const paymentNumber = await nextSequence('paymentNumber', 'PAY', session);
        await Payment.create(
          [
            {
              paymentNumber,
              amount: paid,
              method: paymentMethod === 'LOAN' || paymentMethod === 'CREDIT' ? 'CASH' : paymentMethod,
              reference: paymentReference,
              type: 'ON_DEMAND_PAYMENT',
              sale: sale._id,
              onDemand: onDemand._id,
              customer: customer._id,
              customerName: customer.name,
              receivedBy: user._id,
              notes: 'On-demand customer payment'
            }
          ],
          { session }
        );
      }

      // Track stock only if the item physically entered and left our stock - by default it does not.
      // When `receiveIntoStock` is true the supplier purchase adds stock and the sale removes it.

      // 5. Credit / loan for unpaid customer balance.
      if (balance > 0) {
        const loanNumber = await nextSequence('loanNumber', 'LN', session);
        const finalDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + (settings.defaultDueDays || 30) * 86400000);
        await Loan.create(
          [
            {
              loanNumber,
              customer: customer._id,
              customerName: customer.name,
              customerPhone: customer.phone,
              sale: sale._id,
              onDemand: onDemand._id,
              saleNumber: sale.saleNumber,
              onDemandNumber: transactionNumber,
              items: itemSnapshots.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.sellingPrice })),
              totalAmount: totalAmount,
              amountPaid: paid,
              outstandingBalance: balance,
              dueDate: finalDueDate,
              status: paid > 0 ? 'PARTIALLY_PAID' : 'ACTIVE',
              createdBy: user._id
            }
          ],
          { session }
        );
      }

      // 6. Customer aggregates.
      customer.totalPurchases += totalAmount;
      customer.totalPaid += paid;
      customer.outstandingBalance += balance;
      await customer.save({ session });

      // 7. Update OnDemand with linked references.
      onDemand.sale = sale._id;
      onDemand.purchase = firstPurchaseId;
      await onDemand.save({ session });

      await notify({
        type: 'NEW_ON_DEMAND',
        title: 'On-Demand Sale',
        message: `${transactionNumber}: ${customer.name} bought ${itemSnapshots.length} item(s) via ${supplierLabel}, total ${totalAmount.toLocaleString()} RWF, profit ${totalProfit.toLocaleString()} RWF.`,
        link: `/on-demand/${onDemand._id}`,
        meta: { onDemandId: onDemand._id },
        session
      });

      await logAction({
        user,
        action: ACTIONS.ONDEMAND_CREATE,
        entity: 'OnDemand',
        entityId: onDemand._id,
        description: `Created on-demand sale ${transactionNumber} for ${customer.name} via ${supplierLabel}, cost ${totalCost} RWF, revenue ${totalAmount} RWF, profit ${totalProfit} RWF.`,
        details: { items: itemSnapshots, suppliers: supplierNames, totalCost, totalAmount, totalProfit, paid, supplierPaid: supplierPaidOk },
        session
      });

      result = { onDemand, sale, purchases };
    });
    return result;
  } finally {
    session.endSession();
  }
};

/** Records an additional payment against an on-demand transaction (customer side or supplier side). */
const recordOnDemandPayment = async ({ onDemandId, side, amount, method, reference, notes, supplierId, user }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const onDemand = await OnDemand.findById(onDemandId).session(session);
      if (!onDemand) throw new ApiError(404, 'On-Demand transaction not found.');
      if (onDemand.status === 'CANCELLED') throw new ApiError(400, 'Transaction is cancelled.');

      const payAmount = Number(amount);
      if (!payAmount || payAmount <= 0) throw new ApiError(400, 'Payment amount must be greater than zero.');
      if (!['CASH', 'MOMO', 'BANK'].includes(method)) throw new ApiError(400, 'Payment method must be CASH, MOMO or BANK.');

      let payment;
      let spPayment;
      let paymentNumber;
      if (side === 'supplier') {
        if (onDemand.supplierDetails && onDemand.supplierDetails.length > 0) {
          const details = onDemand.supplierDetails.filter((d) => d.balance > 0.001);
          const entry = supplierId
            ? onDemand.supplierDetails.find((d) => String(d.supplier) === String(supplierId))
            : (details[0] || onDemand.supplierDetails[0]);
          if (!entry) throw new ApiError(400, 'Supplier not found on this transaction.');
          if (payAmount > entry.balance + 0.001) {
            throw new ApiError(400, `Payment exceeds the outstanding supplier balance of ${entry.balance.toLocaleString()} RWF.`);
          }

          entry.amountPaid += payAmount;
          entry.balance = Math.max(0, entry.balance - payAmount);
          entry.paymentStatus = computeStatus(entry.totalCost, entry.amountPaid);

          const spNumber = await nextSequence('supplierPayment', 'SP', session);
          const purchase = entry.purchase
            ? await Purchase.findById(entry.purchase).session(session)
            : (onDemand.purchase ? await Purchase.findById(onDemand.purchase).session(session) : null);
          [spPayment] = await SupplierPayment.create(
            [
              {
                paymentNumber: spNumber,
                purchase: purchase ? purchase._id : undefined,
                supplier: entry.supplier,
                amount: payAmount,
                paymentMethod: method,
                reference,
                notes: notes || `On-demand supplier payment for ${onDemand.transactionNumber} (${entry.supplierName})`,
                createdBy: user._id
              }
            ],
            { session }
          );
          entry.payments.push({
            paymentNumber: spNumber,
            amount: payAmount,
            method,
            reference,
            receivedBy: user._id,
            receivedAt: new Date()
          });
          if (purchase) {
            purchase.amountPaid += payAmount;
            purchase.remainingAmount = Math.max(0, purchase.totalAmount - purchase.amountPaid);
            purchase.paymentStatus = purchase.remainingAmount <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';
            await purchase.save({ session });
          }
          recomputeSupplierAggregates(onDemand);
          payment = spPayment;
          paymentNumber = spNumber;
        } else {
          // Legacy single-supplier on-demand record.
          if (payAmount > onDemand.supplierBalance + 0.001) {
            throw new ApiError(400, `Payment exceeds the outstanding supplier balance of ${onDemand.supplierBalance.toLocaleString()} RWF.`);
          }
          onDemand.supplierPaid += payAmount;
          onDemand.supplierBalance = Math.max(0, onDemand.supplierBalance - payAmount);
          onDemand.supplierPaymentStatus = computeStatus(onDemand.supplierCost, onDemand.supplierPaid);

          const spNumber = await nextSequence('supplierPayment', 'SP', session);
          const purchase = onDemand.purchase ? await Purchase.findById(onDemand.purchase).session(session) : null;
          [spPayment] = await SupplierPayment.create(
            [
              {
                paymentNumber: spNumber,
                purchase: purchase ? purchase._id : undefined,
                supplier: onDemand.supplier,
                amount: payAmount,
                paymentMethod: method,
                reference,
                notes: notes || `On-demand supplier payment for ${onDemand.transactionNumber}`,
                createdBy: user._id
              }
            ],
            { session }
          );
          if (purchase) {
            purchase.amountPaid += payAmount;
            purchase.remainingAmount = Math.max(0, purchase.totalAmount - purchase.amountPaid);
            if (purchase.remainingAmount <= 0.001) purchase.paymentStatus = 'PAID';
            else purchase.paymentStatus = 'PARTIALLY_PAID';
            await purchase.save({ session });
          }
          payment = spPayment;
          paymentNumber = spNumber;
        }
      } else {
        if (payAmount > onDemand.balance + 0.001) {
          throw new ApiError(400, `Payment exceeds the outstanding customer balance of ${onDemand.balance.toLocaleString()} RWF.`);
        }
        onDemand.amountPaid += payAmount;
        onDemand.balance = Math.max(0, onDemand.balance - payAmount);
        onDemand.paymentStatus = computeStatus(onDemand.totalAmount, onDemand.amountPaid);

        const paymentNumber = await nextSequence('paymentNumber', 'PAY', session);
        [payment] = await Payment.create(
          [
            {
              paymentNumber,
              amount: payAmount,
              method,
              reference,
              type: 'ON_DEMAND_PAYMENT',
              sale: onDemand.sale,
              onDemand: onDemand._id,
              customer: onDemand.customer,
              customerName: onDemand.customerName,
              receivedBy: user._id,
              notes: notes || 'On-demand additional payment'
            }
          ],
          { session }
        );

        // Update linked sale.
        const sale = onDemand.sale ? await Sale.findById(onDemand.sale).session(session) : null;
        if (sale && sale.status === 'COMPLETED') {
          sale.amountPaid += payAmount;
          sale.balance = Math.max(0, sale.balance - payAmount);
          sale.paymentStatus = computeStatus(sale.total, sale.amountPaid);
          await sale.save({ session });
        }

        // Settle any linked loan.
        const loan = await Loan.findOne({ onDemand: onDemand._id, status: { $nin: ['PAID', 'CANCELLED'] } }).session(session);
        if (loan) {
          loan.amountPaid += payAmount;
          loan.outstandingBalance = Math.max(0, loan.outstandingBalance - payAmount);
          loan.status = loan.outstandingBalance <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';
          await loan.save({ session });
        }

        // Customer aggregates.
        const customer = await Customer.findById(onDemand.customer).session(session);
        if (customer) {
          customer.totalPaid += payAmount;
          customer.outstandingBalance = Math.max(0, customer.outstandingBalance - payAmount);
          await customer.save({ session });
        }
      }

      if (onDemand.balance <= 0.001 && onDemand.supplierBalance <= 0.001) {
        onDemand.status = 'COMPLETED';
      }

      await onDemand.save({ session });

      await logAction({
        user,
        action: ACTIONS.ONDEMAND_PAYMENT,
        entity: 'OnDemand',
        entityId: onDemand._id,
        description: `On-demand payment (${side}): ${payAmount} RWF on ${onDemand.transactionNumber}.`,
        details: { side, amount: payAmount, method },
        session
      });

      result = { onDemand, payment };
    });
    return result;
  } finally {
    session.endSession();
  }
};

/** Cancels an on-demand transaction and reverses the linked sale/customer aggregates. */
const cancelOnDemand = async ({ onDemandId, reason, user }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const onDemand = await OnDemand.findById(onDemandId).session(session);
      if (!onDemand) throw new ApiError(404, 'On-Demand transaction not found.');
      if (onDemand.status === 'CANCELLED') throw new ApiError(400, 'Transaction is already cancelled.');

      const customer = await Customer.findById(onDemand.customer).session(session);

      // Reverse customer aggregates (paid amounts and outstanding are reversed as far as possible).
      if (customer) {
        customer.totalPurchases = Math.max(0, customer.totalPurchases - onDemand.totalAmount);
        customer.totalPaid = Math.max(0, customer.totalPaid - onDemand.amountPaid);
        if (onDemand.balance > 0) customer.outstandingBalance = Math.max(0, customer.outstandingBalance - onDemand.balance);
        await customer.save({ session });
      }

      const sale = onDemand.sale ? await Sale.findById(onDemand.sale).session(session) : null;
      if (sale) {
        sale.status = 'CANCELLED';
        sale.cancelledReason = reason;
        await sale.save({ session });
      }

      await Loan.updateMany(
        { onDemand: onDemand._id, status: { $nin: ['PAID', 'CANCELLED'] } },
        { $set: { status: 'CANCELLED', cancelReason: reason } },
        { session }
      );

      onDemand.status = 'CANCELLED';
      onDemand.notes = `${onDemand.notes ? onDemand.notes + '; ' : ''}Cancelled: ${reason}`;
      await onDemand.save({ session });

      await logAction({
        user,
        action: ACTIONS.ONDEMAND_CANCEL,
        entity: 'OnDemand',
        entityId: onDemand._id,
        description: `Cancelled on-demand transaction ${onDemand.transactionNumber}. Reason: ${reason}`,
        details: { reason },
        session
      });

      result = onDemand;
    });
    return result;
  } finally {
    session.endSession();
  }
};

const resolveCustomer = async ({ customerId, name, phone, session }) => {
  if (customerId) {
    const customer = await Customer.findById(customerId).session(session);
    if (!customer) throw new ApiError(404, 'Customer not found.');
    return customer;
  }
  if (!phone) throw new ApiError(400, 'Either an existing customer or a name and phone number is required.');
  let customer = await Customer.findOne({ phone: String(phone).trim() }).session(session);
  if (customer) return customer;
  if (!name) throw new ApiError(400, 'Customer name is required for a new customer.');
  [customer] = await Customer.create([{ name: name.trim(), phone: String(phone).trim(), status: 'ACTIVE' }], { session });
  return customer;
};

module.exports = { createOnDemand, recordOnDemandPayment, cancelOnDemand };