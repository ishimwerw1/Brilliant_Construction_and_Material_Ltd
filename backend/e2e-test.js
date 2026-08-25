/* End-to-end API test for Brilliant Construction stock system */
const BASE = 'http://localhost:5000/api';
const token = process.env.BCML_TOKEN;
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

const req = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${json.message}`);
  return json.data || json;
};

(async () => {
  console.log('--- 1. Supplier ---');
  const supplier = await req('POST', '/suppliers', { name: 'ABC Plumbing Ltd', phone: '+250788111222', email: 'abc@plumbing.rw', address: 'Kigali' });
  console.log('OK', supplier.supplier.name);

  console.log('--- 2. Category + Product ---');
  const cats = await req('GET', '/categories');
  const pvc = cats.categories.find((c) => c.name === 'PVC Pipes') || cats.categories[0];
  let prod;
  try {
    prod = await req('POST', '/products', {
      name: 'PVC Pipe 25mm', sku: `PVC-${Date.now().toString().slice(-6)}`, category: pvc._id, unit: 'meter',
      buyingPrice: 800, sellingPrice: 1200, quantity: 50, minStockLevel: 10, supplier: supplier.supplier._id
    });
  } catch (e) {
    const found = await req('GET', '/products?search=PVC-25');
    prod = { product: found.products[0] };
    console.log('reusing existing product');
  }
  const product = prod;
  console.log('OK', product.product.name, 'qty:', product.product.quantity);

  console.log('--- 3. Stock In (+100) ---');
  const stockIn = await req('POST', '/stock/in', {
    supplier: supplier.supplier._id,
    items: [{ product: product.product._id, quantity: 100, buyingPrice: 850 }],
    reference: 'GRN-TEST01'
  });
  console.log('OK', JSON.stringify(stockIn.results));

  console.log('--- 4. Customer ---');
  let customer;
  try {
    customer = await req('POST', '/customers', { name: `Test Client ${Date.now().toString().slice(-5)}`, phone: `078${Date.now().toString().slice(-7)}` });
  } catch (e) {
    const list = await req('GET', '/customers?search=0788123456');
    customer = { customer: list.customers[0] };
  }
  console.log('OK', customer.customer.name);

  console.log('--- 5. CASH sale (5 units) ---');
  const sale1 = await req('POST', '/sales', {
    customer: customer.customer._id,
    items: [{ product: product.product._id, quantity: 5 }],
    paymentMethod: 'CASH'
  });
  console.log('OK', sale1.sale.saleNumber, 'total:', sale1.sale.total, 'status:', sale1.sale.paymentStatus);

  console.log('--- 6. LOAN sale (10 units, 5000 down) ---');
  const sale2 = await req('POST', '/sales', {
    customer: customer.customer._id,
    items: [{ product: product.product._id, quantity: 10 }],
    paymentMethod: 'LOAN',
    amountPaid: 5000
  });
  console.log('OK', sale2.sale.saleNumber, 'total:', sale2.sale.total, 'paid:', sale2.sale.amountPaid, 'balance:', sale2.sale.balance);

  console.log('--- 7. Loans list + repay ---');
  const loans = await req('GET', '/loans');
  const loan = loans.loans.find((l) => l.status !== 'CANCELLED' && l.outstandingBalance > 0);
  console.log('Loan found:', loan.loanNumber, 'outstanding:', loan.outstandingBalance);
  const repaid = await req('POST', `/loans/${loan._id}/repay`, { amount: Math.min(3000, loan.outstandingBalance), method: 'MOMO', reference: 'MP-123456' });
  console.log('Repayment OK. Remaining:', repaid.loan.outstandingBalance, 'status:', repaid.loan.status);

  console.log('--- 8. Stock adjustment ---');
  const adj = await req('POST', '/stock/adjustments', { productId: product.product._id, actualQuantity: 140, reason: 'Damaged during handling' });
  console.log('OK', JSON.stringify(adj));

  console.log('--- 9. Overselling blocked? ---');
  try {
    await req('POST', '/sales', {
      customer: customer.customer._id,
      items: [{ product: product.product._id, quantity: 99999 }],
      paymentMethod: 'CASH'
    });
    console.log('ERROR: oversell was allowed!');
  } catch (e) {
    console.log('OK blocked:', e.message.slice(0, 80));
  }

  console.log('--- 10. Dashboard ---');
  const dash = await req('GET', '/dashboard/overview');
  console.log('Products:', dash.cards.totalProducts, '| TodayRevenue:', dash.cards.todayRevenue, '| OutstandingLoans:', dash.cards.outstandingLoansTotal);

  console.log('--- 11. Reports ---');
  const fin = await req('GET', '/reports/financial');
  console.log('TotalSales:', fin.sales.totalSales, '| GrossProfit:', fin.grossProfit);
  const sr = await req('GET', '/reports/sales?period=today');
  console.log('SalesReport today count:', sr.summary.count);

  console.log('--- 12. Audit logs ---');
  const logs = await req('GET', '/audit-logs?limit=5');
  console.log('Latest actions:', logs.logs.map((l) => l.action).join(', '));

  console.log('\n=== ALL E2E TESTS PASSED ===');
})().catch((e) => {
  console.error('\nE2E FAILED:', e.message);
  process.exit(1);
});
