import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Form, Button, Table, Badge } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function PurchaseVsSalesReport() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [product, setProduct] = useState('')
  const [supplier, setSupplier] = useState('')
  const [customer, setCustomer] = useState('')
  const [type, setType] = useState('ALL')
  const [search, setSearch] = useState('')

  const [lookups, setLookups] = useState({ products: [], suppliers: [], customers: [] })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    setData(null)
    const params = { from, to }
    if (product) params.product = product
    if (supplier) params.supplier = supplier
    if (customer) params.customer = customer
    if (type !== 'ALL') params.type = type
    if (search.trim()) params.search = search.trim()
    api.get('/reports/purchase-vs-sales', { params })
      .then((r) => setData(r.data.data))
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load the analysis'))
  }, [from, to, product, supplier, customer, type, search])

  useEffect(() => {
    api.get('/products', { params: { limit: 300, status: 'ACTIVE' } }).then((r) =>
      setLookups((l) => ({ ...l, products: r.data.data.products }))
    ).catch(() => { })
    api.get('/suppliers', { params: { limit: 300, status: 'ACTIVE' } }).then((r) =>
      setLookups((l) => ({ ...l, suppliers: r.data.data.suppliers }))
    ).catch(() => { })
    api.get('/customers', { params: { limit: 300, status: 'ACTIVE' } }).then((r) =>
      setLookups((l) => ({ ...l, customers: r.data.data.customers }))
    ).catch(() => { })
  }, [])

  useEffect(() => { load() }, [load])

  const csvRows = useMemo(() => {
    if (!data) return []
    return data.products.map((p, i) => ({
      no: i + 1,
      product: p.name,
      sku: p.sku || '-',
      qtyPurchased: p.qtyPurchased,
      costPurchased: p.costPurchased,
      qtySold: p.qtySold,
      revenue: p.revenue,
      cogs: p.cogs,
      profit: p.profit,
      margin: `${p.marginPct}%`,
      remainingQty: p.remainingQty,
      remainingValue: p.remainingCost
    }))
  }, [data])

  const periodLabel = data
    ? `${new Date(data.period.from).toLocaleDateString()} – ${new Date(data.period.to).toLocaleDateString()}`
    : ''

  if (!data && !error) return <Loading full />

  const s = data?.summary

  return (
    <div className="pbs-sheet">
      {/* Print header — only visible when printing */}
      <div className="pbs-print-header">
        <div className="pbs-print-company">BRILLIANT CONSTRUCTION AND MATERIAL LTD</div>
        <div className="pbs-print-title">Purchase vs Sales Analysis</div>
        <div className="pbs-print-meta">Period: {periodLabel} · Generated {new Date().toLocaleString()}</div>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 no-print">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-arrow-left-right me-2" />Purchase vs Sales Analysis
        </h4>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('purchase-vs-sales-analysis', csvRows, [
            { key: 'no', label: '#' },
            { key: 'product', label: 'Product' },
            { key: 'sku', label: 'SKU' },
            { key: 'qtyPurchased', label: 'Qty Purchased' },
            { key: 'costPurchased', label: 'Purchase Value' },
            { key: 'qtySold', label: 'Qty Sold' },
            { key: 'revenue', label: 'Sales Revenue' },
            { key: 'cogs', label: 'COGS (FIFO)' },
            { key: 'profit', label: 'Profit' },
            { key: 'margin', label: 'Margin %' },
            { key: 'remainingQty', label: 'Remaining Qty' },
            { key: 'remainingValue', label: 'Inventory Value' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print / PDF</Button>
        </div>
      </div>

      {error && <Card body className="text-danger small py-2 mb-3 no-print">{error}</Card>}

      {/* Filters */}
      <Card body className="mb-3 no-print">
        <Row className="g-2 align-items-end">
          <Col xs={6} md={3} xl={2}>
            <Form.Label className="small text-muted mb-1">Product</Form.Label>
            <Form.Select size="sm" value={product} onChange={(e) => setProduct(e.target.value)}>
              <option value="">All products</option>
              {lookups.products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </Form.Select>
          </Col>
          <Col xs={6} md={3} xl={2}>
            <Form.Label className="small text-muted mb-1">Supplier</Form.Label>
            <Form.Select size="sm" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              <option value="">All suppliers</option>
              {lookups.suppliers.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </Form.Select>
          </Col>
          <Col xs={6} md={3} xl={2}>
            <Form.Label className="small text-muted mb-1">Customer</Form.Label>
            <Form.Select size="sm" value={customer} onChange={(e) => setCustomer(e.target.value)}>
              <option value="">All customers</option>
              {lookups.customers.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </Form.Select>
          </Col>
          <Col xs={6} md={3} xl={2}>
            <Form.Label className="small text-muted mb-1">Sale Type</Form.Label>
            <Form.Select size="sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ALL">All types</option>
              <option value="NORMAL">Normal Sales</option>
              <option value="ORDER">Orders</option>
              <option value="ON_DEMAND">On-Demand</option>
            </Form.Select>
          </Col>
          <Col xs={12} md={6} xl={4}>
            <Form.Label className="small text-muted mb-1">Search product / SKU</Form.Label>
            <Form.Control size="sm" type="search" placeholder="Search product or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </Col>
        </Row>
      </Card>

      {/* Summary */}
      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-cart4" label="Total Purchases (Period)" value={formatMoney(s?.totalPurchases)} color="primary" sub={`${s?.purchaseCount || 0} purchases · ${(s?.purchaseQty || 0).toLocaleString()} units`} /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-receipt" label="Total Sales Revenue" value={formatMoney(s?.totalRevenue)} color="success" sub={`${s?.soldCount || 0} sales · ${(s?.soldQty || 0).toLocaleString()} units`} /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-box-seam" label="Cost of Goods Sold (FIFO)" value={formatMoney(s?.cogs)} color="warning" sub={`On-demand: ${formatMoney(s?.onDemandCogs)}`} /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-graph-up" label="Gross Profit" value={formatMoney(s?.grossProfit)} color={s?.grossProfit >= 0 ? 'info' : 'danger'} sub={`Margin: ${(s?.marginPct || 0).toFixed(1)}%`} /></Col>
      </Row>
      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-box" label="Inventory Value (FIFO)" value={formatMoney(s?.inventoryValue)} color="primary" sub={`${(s?.remainingUnits || 0).toLocaleString()} units not yet sold`} /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-stack" label="Avg Purchase Cost / Unit" value={formatMoney(s?.purchaseAvgCost)} color="info" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-coin" label="Avg Selling Price / Unit" value={formatMoney(s?.saleAvgRevenue)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-exclamation-triangle" label="Units Sold w/o Batch Cost" value={(s?.unmatchedSoldUnits || 0).toLocaleString()} color="warning" sub="Valued at current buying price" /></Col>
      </Row>

      {/* Type breakdown */}
      {data?.byType?.length > 0 && (
        <Row className="g-3 mb-3">
          <Col lg={6}>
            <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
              <Card.Body className="py-3 px-4">
                <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}><i className="bi bi-diagram-3 me-1" />Sales Breakdown by Type</h6>
                <div className="table-responsive">
                  <Table size="sm" className="mb-0">
                    <thead><tr><th>Type</th><th className="text-end">Sales</th><th className="text-end">Revenue</th></tr></thead>
                    <tbody>
                      {data.byType.map((b) => (
                        <tr key={b._id}>
                          <td><Badge bg="" className="badge-soft-info">{b._id}</Badge></td>
                          <td className="text-end">{b.count}</td>
                          <td className="text-end fw-semibold">{formatMoney(b.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={6}>
            <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12, background: '#f8fafc' }}>
              <Card.Body className="py-3 px-4">
                <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}><i className="bi bi-info-circle me-1 text-primary" />How Cost Is Calculated</h6>
                <ul className="small ps-3 mb-0" style={{ color: '#4a5a6e', lineHeight: 1.7 }}>
                  <li className="mb-1"><strong>FIFO costing</strong> — each product is costed batch-by-batch from its purchase invoices (Stock In / Purchases). Sold units consume the oldest batches first, so multiple purchase prices are handled correctly.</li>
                  <li className="mb-1"><strong>Unsold stock is never counted</strong> as cost of goods sold — it stays as inventory value at the price of the batches still on hand.</li>
                  <li className="mb-1"><strong>On-demand</strong> sales are costed directly from their supplier purchase cost (never from supplier payments).</li>
                  <li><strong>Cancel/delete flows</strong> (cancelled sales, reversed stock-ins) are respected so returns never inflate profit.</li>
                </ul>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Product table */}
      <Card className="mb-3" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
        <Card.Header className="bg-white fw-semibold fs-6 py-3 d-flex justify-content-between align-items-center">
          <span><i className="bi bi-table me-2 text-primary" />Product-Level Analysis</span>
          <span className="text-muted small fw-normal">{data?.products?.length || 0} product(s)</span>
        </Card.Header>
        <div className="table-responsive">
          <Table size="sm" hover className="mb-0 align-middle text-nowrap">
            <thead>
              <tr>
                <th>#</th><th>Product</th>
                <th className="text-end">Qty Purchased</th><th className="text-end">Purchase Value</th>
                <th className="text-end">Qty Sold</th><th className="text-end">Sales Revenue</th>
                <th className="text-end">COGS (FIFO)</th><th className="text-end">Profit</th>
                <th className="text-end">Margin</th>
                <th className="text-end">Remaining Stock</th><th className="text-end">Inventory Value</th>
              </tr>
            </thead>
            <tbody>
              {data?.products?.length === 0 && (
                <tr><td colSpan={11} className="text-center text-muted py-4">No data for the selected filters.</td></tr>
              )}
              {data?.products?.map((p, i) => (
                <tr key={String(p.productId)}>
                  <td className="text-muted small">{i + 1}</td>
                  <td className="small">
                    <div className="fw-semibold">{p.name}</div>
                    <small className="text-muted">{p.sku || ''}</small>
                  </td>
                  <td className="text-end small">{p.qtyPurchased.toLocaleString()}</td>
                  <td className="text-end small">{formatMoney(p.costPurchased)}</td>
                  <td className="text-end small">{p.qtySold.toLocaleString()}</td>
                  <td className="text-end small">{formatMoney(p.revenue)}</td>
                  <td className="text-end small text-warning">{formatMoney(p.cogs)}</td>
                  <td className="text-end fw-semibold" style={{ color: p.profit >= 0 ? '#1e7e46' : '#c0392b' }}>{formatMoney(p.profit)}</td>
                  <td className={`text-end small ${p.marginPct >= 0 ? 'text-success' : 'text-danger'}`}>{p.marginPct.toFixed(1)}%</td>
                  <td className="text-end small">{p.remainingQty.toLocaleString()} {p.unit || ''}</td>
                  <td className="text-end small">{formatMoney(p.remainingCost)}</td>
                </tr>
              ))}
            </tbody>
            {data?.products?.length > 0 && (
              <tfoot>
                <tr className="table-light fw-bold" style={{ color: '#0d3b66' }}>
                  <td colSpan={3}>Totals ({data.products.length} products)</td>
                  <td className="text-end">{formatMoney(s.totalPurchases)}</td>
                  <td></td>
                  <td className="text-end">{formatMoney(s.totalRevenue)}</td>
                  <td className="text-end">{formatMoney(s.cogs)}</td>
                  <td className="text-end" style={{ color: s.grossProfit >= 0 ? '#1e7e46' : '#c0392b' }}>{formatMoney(s.grossProfit)}</td>
                  <td className="text-end">{s.marginPct.toFixed(1)}%</td>
                  <td></td>
                  <td className="text-end">{formatMoney(s.inventoryValue)}</td>
                </tr>
              </tfoot>
            )}
          </Table>
        </div>
      </Card>
    </div>
  )
}