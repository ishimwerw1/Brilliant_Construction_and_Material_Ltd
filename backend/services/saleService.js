const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
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

const resolveCustomer = async ({ customerId, name, phone, session }) => {
  if (customerId) {
    const customer = await Customer.findById(customerId).session(session);
    if (!customer) throw new ApiError(404, 'Customer not found.');
    return customer;
  }
  if (!phone) throw new ApiError(400, 'Either an existing customer or a name and phone number is required.');
  let customer = await Customer.findOne({ phone: String(phone).trim() }).session(session);
  if (customer) {
    if (name && customer.name.toLowerCase() !== String(name).trim().toLowerCase()) {
      // keep existing customer record; do not duplicate accounts
    }
    return customer;
  }
  if (!name) throw new ApiError(400, 'Customer name is required for a new customer.');
  customer = await Customer.create(
    [{ name: name.trim(), phone: String(phone).trim(), status: 'ACTIVE' }],
    { session }
  );
  return customer[0];
};

/**
 * Creates a sale atomically:
 * validate -> create sale -> decrement stock (+transactions) -> payment(s) -> loan if credit -> notifications -> audit.
 *
 * Supports multiple products, an editable per-item selling price (unitPrice), optional per-item
 * cost override (costPrice) used by on-demand / order fulfilment, partial payment for any method,
 * and snapshots actual cost/profit values at the time of the transaction.
 */
const createSale = async ({ payload, user }) => {
  const settings = await Setting.getSettings();
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const {
        items,
        discount = 0,
        amountPaid = 0,
        paymentMethod,
        paymentReference,
        dueDate,
        notes,
        order,
        onDemand,
        saleType = 'NORMAL',
        deductStock = true,
        skipStockCheck = false,
        skipCustomerAggregates = false,
        skipPaymentRecord = false
      } = payload;

      if (!Array.isArray(items) || items.length === 0) {
        throw new ApiError(400, 'Sale must contain at least one product.');
      }

      const saleTypes = ['NORMAL', 'ORDER', 'ON_DEMAND'];
      if (!saleTypes.includes(saleType)) throw new ApiError(400, 'Invalid sale type.');

      const allowedMethods = ['CASH', 'MOMO', 'BANK', 'LOAN', 'CREDIT'];
      if (!allowedMethods.includes(paymentMethod)) {
        throw new ApiError(400, 'Payment method must be one of CASH, MOMO, BANK, LOAN, CREDIT.');
      }
      if ((paymentMethod === 'MOMO' || paymentMethod === 'BANK') && !paymentReference) {
        throw new ApiError(400, `A transaction/reference number is required for ${paymentMethod} payments.`);
      }

      const customer = await resolveCustomer({
        customerId: payload.customer,
        name: payload.customerName,
        phone: payload.customerPhone,
        session
      });

      // Validate products & availability, build snapshots with actual transaction values.
      const saleItems = [];
      for (const item of items) {
        const product = await Product.findById(item.product).session(session);
        if (!product) throw new ApiError(404, `Product not found: ${item.product}`);
        if (product.status !== 'ACTIVE') {
          throw new ApiError(400, `Product "${product.name}" is inactive.`);
        }
        const qty = Number(item.quantity);
        if (!qty || qty <= 0) throw new ApiError(400, `Invalid quantity for "${product.name}".`);
        const available = product.quantity;
        if (qty > available && !settings.allowBackorders && !skipStockCheck && user.role.name !== 'Super Admin') {
          throw new ApiError(400, `Not enough stock for "${product.name}". Available: ${available}.`);
        }
        const unitPrice = Number(item.unitPrice ?? product.sellingPrice);
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new ApiError(400, `Invalid price for "${product.name}".`);
        const costPriceAtSale = Number.isFinite(Number(item.costPrice)) && Number(item.costPrice) >= 0
          ? Number(item.costPrice)
          : Number(product.buyingPrice) || 0;
        const itemDiscount = Math.max(0, Number(item.discount || 0));
        const totalRevenue = qty * unitPrice - itemDiscount;
        const totalCost = costPriceAtSale * qty;
        saleItems.push({
          product: product._id,
          productName: product.name,
          sku: product.sku,
          quantity: qty,
          unitPrice,
          discount: itemDiscount,
          subtotal: totalRevenue,
          costPriceAtSale,
          sellingPriceAtSale: unitPrice,
          totalCost,
          totalRevenue,
          profit: totalRevenue - totalCost
        });
      }

      const subtotal = saleItems.reduce((s, i) => s + i.subtotal, 0);
      const totalDiscount = Math.max(0, Number(discount));
      if (totalDiscount > subtotal) throw new ApiError(400, 'Discount cannot exceed the subtotal.');
      const total = subtotal - totalDiscount;
      const totalCost = saleItems.reduce((s, i) => s + i.totalCost, 0);
      const totalProfit = total - totalCost;

      // Determine paid amount. Any method may be paid partially; a balance creates a credit record.
      const explicit = Number(amountPaid);
      let paidAmount;
      if (paymentMethod === 'LOAN' || paymentMethod === 'CREDIT') {
        paidAmount = Math.max(0, Number.isFinite(explicit) ? explicit : 0);
      } else {
        paidAmount = Number.isFinite(explicit) && explicit > 0 ? Math.min(explicit, total) : total;
      }
      if (!Number.isFinite(paidAmount) || paidAmount < 0) throw new ApiError(400, 'Invalid payment amount.');
      if (paidAmount > total) {
        throw new ApiError(400, 'Paid amount cannot exceed the sale total.');
      }

      const balance = Math.max(0, total - paidAmount);
      const saleNumber = await nextSequence('saleNumber', 'INV', session);

      // A balance implies credit terms regardless of the selected payment method.
      const effectivePaymentMethod = balance > 0 ? (paymentMethod === 'LOAN' ? 'LOAN' : 'MIXED') : paymentMethod;

      const [sale] = await Sale.create(
        [
          {
            saleNumber,
            customer: customer._id,
            customerName: customer.name,
            items: saleItems,
            subtotal,
            discount: totalDiscount,
            total,
            totalCost,
            totalProfit,
            amountPaid: paidAmount,
            balance,
            paymentMethod: effectivePaymentMethod,
            paymentStatus: computeStatus(total, paidAmount),
            saleType,
            paymentReference,
            cashier: user._id,
            notes,
            order,
            onDemand
          }
        ],
        { session }
      );

      // Stock movements (skipped for on-demand sales where goods never enter own stock)
      if (deductStock) {
        for (const item of saleItems) {
          await applyStockMovement({
            productId: item.product,
            type: 'SALE',
            quantity: item.quantity,
            reason: `Sold on ${sale.saleNumber}`,
            reference: sale.saleNumber,
            unitPrice: item.unitPrice,
            sale: sale._id,
            user,
            session
          });
        }
      }

      // Payment records
      if (paidAmount > 0 && !skipPaymentRecord) {
        const paymentNumber = await nextSequence('paymentNumber', 'PAY', session);
        await Payment.create(
          [
            {
              paymentNumber,
              amount: paidAmount,
              method: (paymentMethod === 'LOAN' || paymentMethod === 'CREDIT') ? 'CASH' : paymentMethod,
              reference: paymentReference,
              type: 'SALE_PAYMENT',
              sale: sale._id,
              customer: customer._id,
              customerName: customer.name,
              receivedBy: user._id,
              notes: (paymentMethod === 'LOAN' || paymentMethod === 'CREDIT') ? 'Down payment on credit sale' : undefined
            }
          ],
          { session }
        );
      }

      // Loan / credit record when unpaid balance remains
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
              saleNumber: sale.saleNumber,
              items: saleItems.map((i) => ({
                productName: i.productName,
                quantity: i.quantity,
                unitPrice: i.unitPrice
              })),
              totalAmount: total,
              amountPaid: paidAmount,
              outstandingBalance: balance,
              dueDate: finalDueDate,
              status: paidAmount > 0 ? 'PARTIALLY_PAID' : 'ACTIVE',
              createdBy: user._id
            }
          ],
          { session }
        );

        await notify({
          type: 'LOAN_CREATED',
          title: 'New Credit Sale',
          message: `${customer.name} owes ${balance.toLocaleString()} RWF on ${sale.saleNumber} (${loanNumber}). Due ${finalDueDate.toISOString().slice(0, 10)}.`,
          link: '/loans',
          meta: { saleId: sale._id },
          session
        });
      }

      // Customer aggregates
      if (!skipCustomerAggregates) {
        customer.totalPurchases += total;
        customer.totalPaid += paidAmount;
        customer.outstandingBalance += balance;
        await customer.save({ session });
      }

      await notify({
        type: 'NEW_SALE',
        title: 'New Sale',
        message: `${sale.saleNumber}: ${customer.name} purchased ${saleItems.length} product(s) for ${total.toLocaleString()} RWF.`,
        link: `/sales/${sale._id}`,
        meta: { saleId: sale._id },
        session
      });

      await logAction({
        user,
        action: ACTIONS.SALE_CREATE,
        entity: 'Sale',
        entityId: sale._id,
        description: `Created sale ${sale.saleNumber} for ${customer.name}, total ${total} RWF, paid ${paidAmount} RWF, cost ${totalCost} RWF, profit ${totalProfit} RWF.`,
        details: { items: saleItems, total, totalCost, totalProfit, paidAmount, balance, paymentMethod, saleType },
        session
      });

      result = sale;
    });
    return result;
  } finally {
    session.endSession();
  }
};

/** Cancels a sale: restores stock, cancels linked loans, reverses customer aggregates. */
const cancelSale = async ({ saleId, reason, user }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const sale = await Sale.findById(saleId).session(session);
      if (!sale) throw new ApiError(404, 'Sale not found.');
      if (sale.status === 'CANCELLED') throw new ApiError(400, 'Sale is already cancelled.');

      // On-demand sales never touch our own stock, so do not restore anything.
      if (sale.saleType !== 'ON_DEMAND') {
        for (const item of sale.items) {
          await applyStockMovement({
            productId: item.product,
            type: 'SALE_CANCEL',
            quantity: item.quantity,
            reason: `Sale ${sale.saleNumber} cancelled: ${reason}`,
            reference: sale.saleNumber,
            user,
            session
          });
        }
      }

      // If this was an on-demand sale, cancel the linked on-demand transaction too.
      if (sale.saleType === 'ON_DEMAND' && sale.onDemand) {
        const OnDemand = require('../models/OnDemand');
        const onDemand = await OnDemand.findById(sale.onDemand).session(session);
        if (onDemand && onDemand.status !== 'CANCELLED') {
          onDemand.status = 'CANCELLED';
          onDemand.notes = `${onDemand.notes ? onDemand.notes + '; ' : ''}Linked sale ${sale.saleNumber} cancelled: ${reason}`;
          await onDemand.save({ session });
        }
      }

      const loans = await Loan.find({ sale: sale._id, status: { $nin: ['CANCELLED', 'PAID'] } }).session(session);
      for (const loan of loans) {
        loan.status = 'CANCELLED';
        loan.cancelReason = `Linked sale ${sale.saleNumber} cancelled`;
        await loan.save({ session });
      }

      const customer = await Customer.findById(sale.customer).session(session);
      if (customer) {
        customer.totalPurchases = Math.max(0, customer.totalPurchases - sale.total);
        customer.totalPaid = Math.max(0, customer.totalPaid - sale.amountPaid);
        const loanBalance = loans.reduce((s, l) => s + l.outstandingBalance, 0);
        customer.outstandingBalance = Math.max(0, customer.outstandingBalance - loanBalance);
        await customer.save({ session });
      }

      sale.status = 'CANCELLED';
      sale.cancelledReason = reason;
      await sale.save({ session });

      await logAction({
        user,
        action: ACTIONS.SALE_CANCEL,
        entity: 'Sale',
        entityId: sale._id,
        description: `Cancelled sale ${sale.saleNumber}. Reason: ${reason}`,
        details: { reason },
        session
      });

      result = sale;
    });
    return result;
  } finally {
    session.endSession();
  }
};

/** Adds a repayment to a loan (and updates the linked sale + customer). */
const repayLoan = async ({ loanId, amount, method, reference, notes, user }) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const loan = await Loan.findById(loanId).session(session);
      if (!loan) throw new ApiError(404, 'Loan not found.');
      if (['PAID', 'CANCELLED'].includes(loan.status)) {
        throw new ApiError(400, `This loan is already ${loan.status.toLowerCase()}.`);
      }
      const payAmount = Number(amount);
      if (!payAmount || payAmount <= 0) throw new ApiError(400, 'Payment amount must be greater than zero.');
      if (payAmount > loan.outstandingBalance + 0.001) {
        throw new ApiError(400, `Payment exceeds the outstanding balance of ${loan.outstandingBalance.toLocaleString()} RWF.`);
      }

      const previousBalance = loan.outstandingBalance;
      const newBalance = Math.max(0, previousBalance - payAmount);

      const paymentNumber = await nextSequence('paymentNumber', 'PAY', session);
      const payment = await Payment.create(
        [
          {
            paymentNumber,
            amount: payAmount,
            method,
            reference,
            type: 'LOAN_REPAYMENT',
            sale: loan.sale,
            loan: loan._id,
            customer: loan.customer,
            customerName: loan.customerName,
            receivedBy: user._id,
            notes
          }
        ],
        { session }
      );

      loan.amountPaid += payAmount;
      loan.outstandingBalance = newBalance;
      loan.status = newBalance <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';
      await loan.save({ session });

      const sale = await Sale.findById(loan.sale).session(session);
      if (sale && sale.status === 'COMPLETED') {
        sale.amountPaid += payAmount;
        sale.balance = Math.max(0, sale.balance - payAmount);
        sale.paymentStatus = computeStatus(sale.total, sale.amountPaid);
        await sale.save({ session });
      }

      // If this loan settled an order that has not yet been converted, update the order too.
      if (loan.order) {
        const Order = require('../models/Order');
        const order = await Order.findById(loan.order).session(session);
        if (order) {
          order.amountPaid += payAmount;
          order.balance = Math.max(0, order.balance - payAmount);
          if (order.balance <= 0.001 && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && !order.sale) {
            // Fully repaid through the loan: convert the order into a sale now (no duplicate payments).
            const { finalizeOrder } = require('./orderService');
            await finalizeOrder({ order, session, user, customerAccountingDone: true });
          } else if (order.status === 'PENDING' || order.status === 'CONFIRMED') {
            order.status = 'PARTIALLY_PAID';
            await order.save({ session });
          } else if (order.balance <= 0.001) {
            order.status = 'PAID';
            await order.save({ session });
          }
        }
      }

      const customer = await Customer.findById(loan.customer).session(session);
      if (customer) {
        customer.totalPaid += payAmount;
        customer.outstandingBalance = Math.max(0, customer.outstandingBalance - payAmount);
        await customer.save({ session });
      }

      await notify({
        type: 'LOAN_REPAYMENT',
        title: 'Loan Repayment Received',
        message: `${loan.customerName} repaid ${payAmount.toLocaleString()} RWF on ${loan.loanNumber}. Remaining: ${newBalance.toLocaleString()} RWF.`,
        link: `/loans/${loan._id}`,
        meta: { loanId: loan._id },
        session
      });

      await logAction({
        user,
        action: ACTIONS.LOAN_REPAYMENT,
        entity: 'Loan',
        entityId: loan._id,
        description: `Repayment ${paymentNumber}: ${payAmount} RWF from ${loan.customerName} on ${loan.loanNumber}. Balance ${previousBalance} -> ${newBalance}.`,
        details: { paymentNumber, amount: payAmount, method, previousBalance, newBalance },
        session
      });

      result = { loan, payment };
    });
    return result;
  } finally {
    session.endSession();
  }
};

module.exports = { createSale, cancelSale, repayLoan };
