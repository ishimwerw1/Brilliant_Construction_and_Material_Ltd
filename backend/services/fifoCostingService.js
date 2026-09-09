const StockTransaction = require('../models/StockTransaction');
const Product = require('../models/Product');
const Sale = require('../models/Sale');

/**
 * FIFO inventory costing engine (single-pass).
 *
 * Replays the full stock-movement history per product and values, at purchase-batch
 * level, what was actually SOLD in a period. When the same product is bought at
 * different prices on different dates, sold units are attributed the cost of the
 * OLDEST purchase batches first (First-In-First-Out). Unsold stock is never counted
 * as cost of goods sold.
 *
 * - IN types push batches onto the register (STOCK_IN carries the purchase cost).
 * - SALE / ON_DEMAND_SALE consume batches and record the batch cost consumed.
 * - DAMAGED / LOST / STOCK_IN_REVERSE / TRANSFER / negative ADJUSTMENT consume batches
 *   but are NOT cost of goods sold.
 * - SALE_CANCEL returns units to stock at the cancelled sale's snapshot cost.
 * - On-demand sales that never entered our own stock create no movements; their cost is
 *   taken directly from the sale item snapshot (see reportController).
 */

const IN_TYPES = ['STOCK_IN', 'STOCK_IN_ON_DEMAND', 'RETURN', 'OPENING_STOCK'];
const SELL_TYPES = ['SALE', 'ON_DEMAND_SALE'];
const CONSUME_TYPES = ['DAMAGED', 'LOST', 'STOCK_IN_REVERSE', 'TRANSFER'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const defaultSaleTypes = () => new Set(['NORMAL', 'ORDER', 'ON_DEMAND']);

/**
 * Pure FIFO replay. `movements` must be chronological (createdAt asc, _id asc).
 * Each movement: { _id, product, productName, sku, type, quantity, unitPrice,
 *   reference, sale, createdAt }.
 * productMap: pid(string) -> { name, sku, unit, buyingPrice }
 * saleMeta: saleId(string) -> { saleType, status }
 * cancelItemCosts: saleNumber -> pid -> cost
 * Returns a Map of pid -> register.
 */
const replay = ({ movements, productMap, saleMeta, cancelItemCosts, fromMs, toMs, attributedTypes }) => {
  const registers = new Map();

  const regFor = (mov) => {
    const pid = String(mov.product || mov.productId);
    let reg = registers.get(pid);
    if (!reg) {
      const prod = productMap.get(pid);
      reg = {
        pid,
        productId: mov.product,
        name: mov.productName || prod?.name || '',
        sku: mov.sku || prod?.sku || '',
        unit: prod?.unit || 'piece',
        batches: [],
        soldQty: 0,
        soldCost: 0,
        unmatchedSoldQty: 0,
        unmatchedSoldCost: 0,
        consumedNonSaleQty: 0,
        batchesConsumed: 0,
        batchesRemaining: 0,
        remainingQty: 0,
        remainingCost: 0
      };
      registers.set(pid, reg);
    }
    return reg;
  };

  const consume = (reg, qty) => {
    let remaining = qty;
    let consumed = 0;
    let cost = 0;
    let touched = 0;
    while (remaining > 0 && reg.batches.length) {
      const batch = reg.batches[0];
      const take = Math.min(batch.qty, remaining);
      batch.qty -= take;
      remaining -= take;
      consumed += take;
      cost += take * batch.cost;
      touched += 1;
      if (batch.qty <= 0) reg.batches.shift();
    }
    return { consumed, cost, touched };
  };

  for (const mov of movements) {
    const reg = regFor(mov);
    const createdAt = mov.createdAt ? new Date(mov.createdAt) : null;
    const t = createdAt ? createdAt.getTime() : 0;
    const inPeriod = (!fromMs || t >= fromMs) && (!toMs || t <= toMs);

    if (IN_TYPES.includes(mov.type)) {
      const cost = Number(mov.unitPrice) > 0 ? Number(mov.unitPrice) : (productMap.get(reg.pid)?.buyingPrice || 0);
      reg.batches.push({ qty: Number(mov.quantity) || 0, cost, date: createdAt, source: mov.type });
      continue;
    }

    if (mov.type === 'SALE_CANCEL') {
      let cost = productMap.get(reg.pid)?.buyingPrice || 0;
      const itemCost = cancelItemCosts.get(mov.reference)?.get(reg.pid);
      if (Number(itemCost) > 0) cost = Number(itemCost);
      reg.batches.push({ qty: Number(mov.quantity) || 0, cost, date: createdAt, source: 'SALE_CANCEL' });
      continue;
    }

    if (SELL_TYPES.includes(mov.type)) {
      const meta = mov.sale ? saleMeta.get(String(mov.sale)) : null;
      const saleType = meta?.saleType || 'NORMAL';
      const isCancelled = meta?.status === 'CANCELLED';
      const qty = Number(mov.quantity) || 0;
      const { consumed, cost, touched } = consume(reg, qty);
      if (inPeriod && !isCancelled && attributedTypes.has(saleType)) {
        const unmatched = Math.max(0, qty - consumed);
        const fallback = productMap.get(reg.pid)?.buyingPrice || 0;
        reg.soldQty += qty;
        reg.soldCost += cost + unmatched * fallback;
        reg.unmatchedSoldQty += unmatched;
        reg.unmatchedSoldCost += unmatched * fallback;
        reg.batchesConsumed += touched;
      }
      continue;
    }

    if (CONSUME_TYPES.includes(mov.type)) {
      const qty = Number(mov.quantity) || 0;
      consume(reg, qty);
      reg.consumedNonSaleQty += qty;
      continue;
    }

    if (mov.type === 'ADJUSTMENT') {
      const diff = Number(mov.quantity) || 0;
      if (diff > 0) {
        reg.batches.push({ qty: diff, cost: productMap.get(reg.pid)?.buyingPrice || 0, date: createdAt, source: 'ADJUSTMENT' });
      } else {
        consume(reg, -diff);
        reg.consumedNonSaleQty += -diff;
      }
      continue;
    }

    if (mov.type === 'ADJUSTMENT_REVERSE') {
      const qty = Math.max(0, -(Number(mov.quantity) || 0));
      consume(reg, qty);
      reg.consumedNonSaleQty += qty;
    }
  }

  return registers;
};

/** @param {object} opts
 *  @param {Date} [opts.from]           period start (inclusive)
 *  @param {Date} [opts.to]             period end (inclusive)
 *  @param {string[]} [opts.productIds] restrict to specific products
 *  @param {string[]} [opts.saleTypes]  sale types to attribute COGS for (NORMAL/ORDER/ON_DEMAND)
 */
const buildFifoAnalysis = async ({ from, to, productIds, saleTypes }) => {
  const attributedTypes = saleTypes && saleTypes.length ? new Set(saleTypes) : defaultSaleTypes();

  const filter = productIds && productIds.length ? { product: { $in: productIds } } : {};
  const movements = await StockTransaction.find(filter).sort({ createdAt: 1, _id: 1 }).lean();
  if (!movements.length) return { products: [], totals: { soldQty: 0, soldCost: 0, unmatchedSoldQty: 0 } };

  const productIdSet = [...new Set(movements.map((m) => String(m.product || m.productId)).filter(Boolean))];
  const products = await Product.find({ _id: { $in: productIdSet } }).select('name sku unit buyingPrice').lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  // Resolve sale type / cancelled state for every outbound sale movement.
  const sellSaleIds = [...new Set(movements.filter((m) => SELL_TYPES.includes(m.type)).map((m) => m.sale).filter(Boolean))];
  const saleMeta = new Map();
  if (sellSaleIds.length) {
    const sales = await Sale.find({ _id: { $in: sellSaleIds } }).select('saleType status').lean();
    for (const s of sales) saleMeta.set(String(s._id), s);
  }

  // Resolve batch cost of SALE_CANCEL movements from the cancelled sale snapshot.
  const cancelRefs = [...new Set(movements.filter((m) => m.type === 'SALE_CANCEL' && m.reference).map((m) => m.reference))];
  const cancelItemCosts = new Map(); // saleNumber -> productId -> cost
  if (cancelRefs.length) {
    const sales = await Sale.find({ saleNumber: { $in: cancelRefs } }).select('saleNumber items').lean();
    for (const s of sales) {
      const byProduct = new Map();
      for (const it of s.items || []) {
        if (!it.product) continue;
        byProduct.set(String(it.product), Number(it.costPriceAtSale) || 0);
      }
      cancelItemCosts.set(s.saleNumber, byProduct);
    }
  }

  const fromMs = from ? new Date(from).getTime() : null;
  // `to` is already an inclusive end (callers pass end-of-day).
  const toMs = to ? new Date(to).getTime() : null;

  const registers = replay({ movements, productMap, saleMeta, cancelItemCosts, fromMs, toMs, attributedTypes });

  const productsOut = [];
  for (const reg of registers.values()) {
    const remainingQty = reg.batches.reduce((s, b) => s + b.qty, 0);
    const remainingCost = reg.batches.reduce((s, b) => s + b.qty * b.cost, 0);
    productsOut.push({
      productId: reg.productId,
      pid: reg.pid,
      name: reg.name,
      sku: reg.sku,
      unit: reg.unit,
      soldQty: round2(reg.soldQty),
      soldCost: round2(reg.soldCost),
      unmatchedSoldQty: round2(reg.unmatchedSoldQty),
      unmatchedSoldCost: round2(reg.unmatchedSoldCost),
      consumedNonSaleQty: round2(reg.consumedNonSaleQty),
      batchesConsumed: reg.batchesConsumed,
      batchesRemaining: reg.batches.length,
      remainingQty: round2(remainingQty),
      remainingCost: round2(remainingCost)
    });
  }

  const totals = {
    soldQty: round2(productsOut.reduce((s, p) => s + p.soldQty, 0)),
    soldCost: round2(productsOut.reduce((s, p) => s + p.soldCost, 0)),
    unmatchedSoldQty: round2(productsOut.reduce((s, p) => s + p.unmatchedSoldQty, 0))
  };

  return { products: productsOut.filter((p) => p.soldQty > 0 || p.remainingQty > 0), totals };
};

module.exports = { buildFifoAnalysis, replay };