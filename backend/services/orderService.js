const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Loan = require('../models/Loan');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');
const { nextSequence } = require('../utils/generateCode');
const { createSale, removeSaleRecord } = require('./saleService');
const { notify } = require('./notificationService');
const { logAction, ACTIONS } = require('./auditService');

/**
 * Creates an order with cost/profit snapshots and per-line editable prices.
 * Orders stay in the Orders section until paid and converted into a sale.
 */
const createOrder = async ({ payload, user }) => {
  const { customer: customerId, items, expectedDeliveryDate, notes } = payload;
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Customer and at least one product line are required.');
  }
  const customer = await Customer.findById(customerId);
  if (!customer) throw new ApiError(404, 'Customer not found.');

  const orderItems = [];
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) throw new ApiError(404, `Product not found: ${item.product}`);
    const qty = Number(item.quantity);
    if (!qty || qty <= 0) throw new ApiError(400, `Invalid quantity for "${product.name}".`);
    const unitPrice = Number(item.unitPrice ?? product.sellingPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new ApiError(400, `Invalid price for "${product.name}".`);
    const costPriceAtOrder = Number.isFinite(Number(item.costPrice)) && Number(item.costPrice) >= 0
      ? Number(item.costPrice)
      : Number(product.buyingPrice) || 0;
    const totalRevenue = qty * unitPrice;
    const totalCost = costPriceAtOrder * qty;
    orderItems.push({
      product: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: qty,
      unitPrice,
      costPriceAtOrder,
      totalCost,
      totalRevenue,
      profit: totalRevenue - totalCost,
      subtotal: totalRevenue
    });
  }

  const total = orderItems.reduce((s, i) => s + i.subtotal, 0);
  const totalCost = orderItems.reduce((s, i) => s + i.totalCost, 0);
  const totalProfit = total - totalCost;

  const session = await Order.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      const orderNumber = await nextSequence('orderNumber', 'ORD', session);
      [order] = await Order.create([{
        orderNumber,
        customer: customerId,
        items: orderItems,
        total,
        totalCost,
        totalProfit,
        amountPaid: 0,
        balance: total,
        status: 'PENDING',
        expectedDeliveryDate,
        notes,
        createdBy: user._id
      }], { session });

      await notify({
        type: 'NEW_ORDER',
        title: 'New Order',
        message: `${order.orderNumber}: ${customer.name} ordered ${orderItems.length} product(s), total ${total.toLocaleString()} RWF.`,
        link: '/orders',
        meta: { orderId: order._id },
        session
      });

      await logAction({
        user, action: ACTIONS.ORDER_CREATE, entity: 'Order', entityId: order._id,
        description: `Created order ${order.orderNumber} for ${customer.name} (${total} RWF).`,
        session
      });
    });
  } finally {
    session.endSession();
  }

  return order;
};

/**
 * Converts a fully-paid order into a completed sale inside the caller's transaction.
 * - `customerAccountingDone`: true when the caller already handled customer totalPaid/outstanding
 *   (e.g. the loan-repayment path), so only totalPurchases is added here.
 * - Settles any open order-linked loan.
 */
const finalizeOrder = async ({ order, session, user, customerAccountingDone = false }) => {
  const settings = await Setting.getSettings();
  const salePayload = {
    customer: order.customer,
    items: order.items.map((i) => ({
      product: i.product,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      costPrice: i.costPriceAtOrder
    })),
    paymentMethod: order.paymentMethod || 'CASH',
    amountPaid: order.total,
    paymentReference: order.paymentReference,
    discount: 0,
    dueDate: undefined,
    notes: `Fulfilled from order ${order.orderNumber}`,
    order: order._id,
    saleType: 'ORDER',
    skipCustomerAggregates: true,
    skipPaymentRecord: true
  };
  const sale = await createSale({ payload: salePayload, user });

  order.sale = sale._id;
  order.status = 'COMPLETED';
  await order.save({ session });

  // Settle any order-linked loan created by earlier partial payments (or repayments).
  const loan = await Loan.findOne({ order: order._id, status: { $nin: ['PAID', 'CANCELLED'] } }).session(session);
  if (loan) {
    loan.amountPaid = loan.totalAmount;
    loan.outstandingBalance = 0;
    loan.status = 'PAID';
    await loan.save({ session });
  }

  const customer = await Customer.findById(order.customer).session(session);
  if (customer) {
    if (!customerAccountingDone) {
      // Direct-payment path handled customer totals in payOrder; here we settle outstanding.
      customer.outstandingBalance = Math.max(0, customer.outstandingBalance - order.balance);
    }
    customer.totalPurchases += order.total;
    await customer.save({ session });
  }

  await notify({
    type: 'NEW_SALE',
    title: 'Order Completed',
    message: `${order.orderNumber} paid in full and converted to sale ${sale.saleNumber}.`,
    link: `/sales/${sale._id}`,
    meta: { orderId: order._id, saleId: sale._id },
    session
  });

  return sale;
};

/**
 * Records a payment against an order.
 * - If the order becomes fully paid, it is converted into a completed sale (no duplicates).
 * - If partially paid, the order stays open as PARTIALLY_PAID and the outstanding balance is
 *   tracked on the customer via an order-linked loan.
 */
const payOrder = async ({ orderId, amount, method, reference, notes, user }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new ApiError(404, 'Order not found.');
      if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
        throw new ApiError(400, `This order is already ${order.status.toLowerCase()}.`);
      }
      if (order.sale) throw new ApiError(400, 'This order has already been converted to a sale.');

      const payAmount = Number(amount);
      if (!payAmount || payAmount <= 0) throw new ApiError(400, 'Payment amount must be greater than zero.');
      if (payAmount > order.balance + 0.001) {
        throw new ApiError(400, `Payment exceeds the outstanding balance of ${order.balance.toLocaleString()} RWF.`);
      }
      if (!['CASH', 'MOMO', 'BANK'].includes(method)) throw new ApiError(400, 'Payment method must be CASH, MOMO or BANK.');
      if ((method === 'MOMO' || method === 'BANK') && !reference) {
        throw new ApiError(400, `A transaction/reference number is required for ${method} payments.`);
      }

      const previousOverdue = order.balance;
      order.amountPaid += payAmount;
      order.balance = Math.max(0, order.total - order.amountPaid);
      order.paymentMethod = method;
      order.paymentReference = reference;

      const paymentNumber = await nextSequence('paymentNumber', 'PAY', session);
      await Payment.create(
        [
          {
            paymentNumber,
            amount: payAmount,
            method,
            reference,
            type: 'ORDER_PAYMENT',
            order: order._id,
            customer: order.customer,
            receivedBy: user._id,
            notes: notes || `Payment toward order ${order.orderNumber}`
          }
        ],
        { session }
      );

      const customer = await Customer.findById(order.customer).session(session);
      if (!customer) throw new ApiError(404, 'Customer not found.');

      let sale = null;

      if (order.balance <= 0.001) {
        // FULLY PAID -> convert to sale inside the same transaction.
        sale = await finalizeOrder({ order, session, user });
        // Customer aggregates: this final payment + the order's full value.
        // totalPaid only increases by the last instalment (earlier ones were already recorded).
        customer.totalPaid += payAmount;
        customer.outstandingBalance = Math.max(0, customer.outstandingBalance - previousOverdue);
        await customer.save({ session });
      } else {
        // PARTIAL -> keep order open, record outstanding via order-linked loan.
        order.status = 'PARTIALLY_PAID';
        let loan = await Loan.findOne({ order: order._id, status: { $nin: ['PAID', 'CANCELLED'] } }).session(session);
        const loanPrevOutstanding = loan ? loan.outstandingBalance : 0;
        if (!loan) {
          const loanNumber = await nextSequence('loanNumber', 'LN', session);
          const settings = await Setting.getSettings();
          const finalDueDate = new Date(Date.now() + (settings.defaultDueDays || 30) * 86400000);
          loan = await Loan.create(
            [
              {
                loanNumber,
                customer: order.customer,
                customerName: customer.name,
                customerPhone: customer.phone,
                order: order._id,
                orderNumber: order.orderNumber,
                items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })),
                totalAmount: order.total,
                amountPaid: order.amountPaid,
                outstandingBalance: order.balance,
                dueDate: finalDueDate,
                status: 'PARTIALLY_PAID',
                createdBy: user._id
              }
            ],
            { session }
          );
        } else {
          loan.amountPaid = order.amountPaid;
          loan.outstandingBalance = order.balance;
          if (loan.amountPaid > 0) loan.status = 'PARTIALLY_PAID';
          await loan.save({ session });
        }

        customer.totalPaid += payAmount;
        customer.outstandingBalance = Math.max(0, customer.outstandingBalance + order.balance - loanPrevOutstanding);
        await customer.save({ session });
      }

      await order.save({ session });

      await notify({
        type: order.balance <= 0.001 ? 'NEW_SALE' : 'LOAN_REPAYMENT',
        title: order.balance <= 0.001 ? 'Order Completed' : 'Order Payment Received',
        message: order.balance <= 0.001
          ? `${order.orderNumber} paid in full and converted to sale ${sale ? sale.saleNumber : ''}.`
          : `${order.orderNumber}: received ${payAmount.toLocaleString()} RWF. Outstanding: ${order.balance.toLocaleString()} RWF.`,
        link: '/orders',
        meta: { orderId: order._id, saleId: sale?._id },
        session
      });

      await logAction({
        user,
        action: order.balance <= 0.001 ? ACTIONS.ORDER_FULFILL : ACTIONS.ORDER_PAYMENT,
        entity: 'Order',
        entityId: order._id,
        description: order.balance <= 0.001
          ? `Order ${order.orderNumber} fully paid (${payAmount} RWF) and converted to sale ${sale ? sale.saleNumber : '-'}.`
          : `Partial payment ${payAmount} RWF on ${order.orderNumber}. Balance ${order.balance.toLocaleString()} RWF.`,
        details: { paymentNumber, amount: payAmount, method, balance: order.balance },
        session
      });

      result = { order, sale };
    });
    return result;
  } finally {
    session.endSession();
  }
};

/** Cancels an order and reverses any recorded outstanding balance. */
const cancelOrder = async ({ orderId, reason, user }) => {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found.');
  if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
    throw new ApiError(400, `Only open orders can be cancelled. This one is ${order.status}.`);
  }
  if (order.sale) throw new ApiError(400, 'This order has already been converted to a sale.');

  const session = await Order.startSession();
  try {
    await session.withTransaction(async () => {
      order.status = 'CANCELLED';
      order.notes = `${order.notes ? order.notes + '; ' : ''}Cancelled: ${reason}`;
      await order.save({ session });

      const loans = await Loan.find({ order: order._id, status: { $nin: ['PAID', 'CANCELLED'] } }).session(session);
      let outstandingToReverse = 0;
      for (const loan of loans) {
        outstandingToReverse += loan.outstandingBalance;
        loan.status = 'CANCELLED';
        loan.cancelReason = `Order ${order.orderNumber} cancelled`;
        await loan.save({ session });
      }

      const customer = await Customer.findById(order.customer).session(session);
      if (customer) {
        customer.outstandingBalance = Math.max(0, customer.outstandingBalance - outstandingToReverse);
        await customer.save({ session });
      }

      await logAction({
        user, action: ACTIONS.ORDER_CANCEL, entity: 'Order', entityId: order._id,
        description: `Cancelled order ${order.orderNumber}. Reason: ${reason}`,
        session
      });
    });
  } finally {
    session.endSession();
  }

  return order;
};

/** Permanently deletes an order and reverses every effect it caused.
 *  - If converted into a sale, the sale (stock, payments, loans) is fully removed too.
 *  - Deletes the order's payments (ORDER_PAYMENT) and order-linked loans + repayments.
 *  - Reverses customer totals (totalPaid / outstanding; totalPurchases via the sale removal). */
const deleteOrder = async ({ orderId, user }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new ApiError(404, 'Order not found.');

      let salePaymentsTotal = 0;
      if (order.sale) {
        const sale = await Sale.findById(order.sale).session(session);
        if (sale) {
          const oldTotal = sale.total;
          const removed = await removeSaleRecord({ sale, session, user });
          salePaymentsTotal = removed.payments.reduce((s, p) => s + p.amount, 0);
          if (order.status !== 'CANCELLED') {
            const customer = await Customer.findById(order.customer).session(session);
            if (customer) {
              customer.totalPurchases = Math.max(0, customer.totalPurchases - oldTotal);
              await customer.save({ session });
            }
          }
        }
      }

      const loans = await Loan.find({ order: order._id }).session(session);
      const loanIds = loans.map((l) => l._id);
      const payments = await Payment.find({
        $or: [{ order: order._id }, { loan: { $in: loanIds } }]
      }).session(session);

      const customer = await Customer.findById(order.customer).session(session);
      if (customer) {
        if (order.status !== 'CANCELLED') {
          const openOutstanding = loans.reduce((s, l) => s + (l.outstandingBalance || 0), 0);
          customer.outstandingBalance = Math.max(0, customer.outstandingBalance - openOutstanding);
        }
        // The money actually collected toward this order: its own payments, the deleted sale's
        // payments (incl. sale-loan repayments) and order-loan repayments.
        const paidToReverse = salePaymentsTotal + payments.reduce((s, p) => s + p.amount, 0);
        customer.totalPaid = Math.max(0, customer.totalPaid - paidToReverse);
        await customer.save({ session });
      }

      for (const p of payments) await p.deleteOne({ session });
      for (const l of loans) await l.deleteOne({ session });
      await order.deleteOne({ session });

      await logAction({
        user,
        action: ACTIONS.ORDER_DELETE,
        entity: 'Order',
        entityId: order._id,
        description: `Deleted order ${order.orderNumber} permanently. Payments, loans and linked sale reversed.`
      });

      result = order;
    });
    return result;
  } finally {
    session.endSession();
  }
};

module.exports = { createOrder, payOrder, cancelOrder, finalizeOrder, deleteOrder };