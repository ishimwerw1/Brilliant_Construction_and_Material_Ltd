const path = require('path');
const { replay } = require(path.join(__dirname, '..', 'services', 'fifoCostingService'));

const day = (d, h = 12) => new Date(`2026-01-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00.000Z`);
const from = new Date('2026-01-01T00:00:00.000Z');
const to = new Date('2026-01-31T23:59:59.999Z');

const P1 = 'prod1';
const productMap = new Map([[P1, { name: 'Cement', sku: 'SKU1', unit: 'bag', buyingPrice: 100 }]]);

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = Math.abs(got - want) < 0.001;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: got ${got}, want ${want}`);
  ok ? pass++ : fail++;
};

let id = 0;
const mov = (o) => ({ _id: `t${++id}`, product: P1, productName: 'Cement', sku: 'SKU1', ...o });

const noSales = new Map();
const cancelNone = new Map();

// Scenario 1: buy 10 @100 (Jan 2), buy 10 @120 (Jan 4). Sell 12 on Jan 5.
// FIFO COGS = 10*100 + 2*120 = 1240. Remaining 8 @120 = 960.
{
  id = 0;
  const movements = [
    mov({ type: 'STOCK_IN', quantity: 10, unitPrice: 100, reference: 'PUR-1', sale: null, createdAt: day(2) }),
    mov({ type: 'STOCK_IN', quantity: 10, unitPrice: 120, reference: 'PUR-2', sale: null, createdAt: day(4) }),
    mov({ type: 'SALE', quantity: 12, unitPrice: 0, reference: 'INV-1', sale: 's1', createdAt: day(5) })
  ];
  const saleMeta = new Map([['s1', { saleType: 'NORMAL', status: 'COMPLETED' }]]);
  const regs = replay({ movements, productMap, saleMeta, cancelItemCosts: cancelNone, fromMs: from.getTime(), toMs: to.getTime(), attributedTypes: new Set(['NORMAL', 'ORDER', 'ON_DEMAND']) });
  const r = regs.get(P1);
  eq('S1 soldCost', r.soldCost, 1240);
  eq('S1 soldQty', r.soldQty, 12);
  eq('S1 remainingCost', r.batches.reduce((s, b) => s + b.qty * b.cost, 0), 960);
  eq('S1 remainingQty', r.batches.reduce((s, b) => s + b.qty, 0), 8);
}

// Scenario 2: sells outside period must not count. Buy 10@100 Jan2, sell 5 on Feb 5 (after period).
{
  id = 0;
  const movements = [
    mov({ type: 'STOCK_IN', quantity: 10, unitPrice: 100, reference: 'PUR-1', sale: null, createdAt: day(2) }),
    mov({ type: 'SALE', quantity: 5, unitPrice: 0, reference: 'INV-2', sale: 's2', createdAt: new Date('2026-02-05T12:00:00.000Z') })
  ];
  const saleMeta = new Map([['s2', { saleType: 'NORMAL', status: 'COMPLETED' }]]);
  const regs = replay({ movements, productMap, saleMeta, cancelItemCosts: cancelNone, fromMs: from.getTime(), toMs: to.getTime(), attributedTypes: new Set(['NORMAL', 'ORDER', 'ON_DEMAND']) });
  const r = regs.get(P1);
  eq('S2 soldCost (outside period)', r.soldCost, 0);
  eq('S2 remainingQty', r.batches.reduce((s, b) => s + b.qty, 0), 5);
}

// Scenario 3: cancelled sale excluded from COGS. Buy 10@100, sell 5 (sale s3 cancelled later), sell 3 (ok).
{
  id = 0;
  const movements = [
    mov({ type: 'STOCK_IN', quantity: 10, unitPrice: 100, reference: 'PUR-1', sale: null, createdAt: day(2) }),
    mov({ type: 'SALE', quantity: 5, unitPrice: 0, reference: 'INV-3', sale: 's3', createdAt: day(5) }),
    mov({ type: 'SALE_CANCEL', quantity: 5, unitPrice: 0, reference: 'INV-3', sale: null, createdAt: day(6) }),
    mov({ type: 'SALE', quantity: 3, unitPrice: 0, reference: 'INV-4', sale: 's4', createdAt: day(8) })
  ];
  const saleMeta = new Map([['s3', { saleType: 'NORMAL', status: 'CANCELLED' }], ['s4', { saleType: 'NORMAL', status: 'COMPLETED' }]]);
  const cancelItemCosts = new Map([['INV-3', new Map([[P1, 100]])]]);
  const regs = replay({ movements, productMap, saleMeta, cancelItemCosts, fromMs: from.getTime(), toMs: to.getTime(), attributedTypes: new Set(['NORMAL', 'ORDER', 'ON_DEMAND']) });
  const r = regs.get(P1);
  eq('S3 soldCost (cancelled excluded)', r.soldCost, 300);
  eq('S3 remainingQty', r.batches.reduce((s, b) => s + b.qty, 0), 7);
}

// Scenario 4: per-type attribution (only ORDER counted).
{
  id = 0;
  const movements = [
    mov({ type: 'STOCK_IN', quantity: 20, unitPrice: 100, reference: 'PUR-1', sale: null, createdAt: day(2) }),
    mov({ type: 'SALE', quantity: 5, unitPrice: 0, reference: 'INV-5', sale: 's5', createdAt: day(5) }),
    mov({ type: 'SALE', quantity: 7, unitPrice: 0, reference: 'INV-6', sale: 's6', createdAt: day(6) })
  ];
  const saleMeta = new Map([['s5', { saleType: 'NORMAL', status: 'COMPLETED' }], ['s6', { saleType: 'ORDER', status: 'COMPLETED' }]]);
  const regs = replay({ movements, productMap, saleMeta, cancelItemCosts: cancelNone, fromMs: from.getTime(), toMs: to.getTime(), attributedTypes: new Set(['ORDER']) });
  const r = regs.get(P1);
  eq('S4 order-only soldQty', r.soldQty, 7);
  eq('S4 order-only soldCost', r.soldCost, 700);
  eq('S4 remainingQty', r.batches.reduce((s, b) => s + b.qty, 0), 8);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);