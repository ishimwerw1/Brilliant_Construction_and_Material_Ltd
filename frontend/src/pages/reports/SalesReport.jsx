import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Form, Button, Table, Badge, InputGroup } from 'react-bootstrap'
import api from '../../api/client'
import Chart from '../../components/common/Charts'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

const PERIODS = [
  ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year'], ['custom', 'Custom']
]
const PAGE_SIZE = 8

const CHART_H = 280

const chartFont = { family: "'Segoe UI', system-ui, sans-serif" }
const axisOpts = { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { font: { size: 10, ...chartFont }, color: '#6b7a90' } }

export default function SalesReport() {
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = () => {
    const params = {}
    if (period === 'custom') {
      if (from) params.from = from
      if (to) params.to = to
    } else params.period = period
    api.get('/reports/sales', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [period, from, to])

  useEffect(() => { setPage(1) }, [search, period])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    return data.byDay.filter((d) =>
      d._id.toLowerCase().includes(q) ||
      String(d.count).includes(q) ||
      String(d.revenue).includes(q) ||
      String(d.received).includes(q)
    )
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (!data) return <Loading full />
  const s = data.summary
  const avgSale = s.count > 0 ? s.revenue / s.count : 0

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-graph-up-arrow me-2" />Sales Report</h4>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Form.Select size="sm" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 140 }}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Form.Select>
          {period === 'custom' && (
            <>
              <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
              <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
            </>
          )}
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('sales-report', data.byDay, [
            { key: '_id', label: 'Date' }, { key: 'count', label: 'Sales Count' },
            { key: 'revenue', label: 'Revenue' }, { key: 'received', label: 'Received' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-receipt" label="Total Sales" value={s.count} color="primary" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-stack" label="Revenue" value={formatMoney(s.revenue)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-wallet2" label="Amount Received" value={formatMoney(s.received)} color="info" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-coin" label="Outstanding" value={formatMoney(s.outstanding)} color="danger" sub={`Discounts: ${formatMoney(s.discounts)}`} /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-receipt-cutoff" style={{ color: '#1a6fb5', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Avg. Sale Value</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{formatMoney(avgSale)}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-cart-check" style={{ color: '#1e7e46', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Items Sold</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{data.topProducts.reduce((a, p) => a + p.qtySold, 0)}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-people" style={{ color: '#6f42c1', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cashiers Active</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{data.byCashier.length}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-tags" style={{ color: '#fd7e14', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Categories</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{data.byCategory.length}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={8}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Revenue Trend</h6>
                <small className="text-muted">Daily revenue vs received</small>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="line" {...{
                  data: {
                    labels: data.byDay.map((d) => d._id),
                    datasets: [
                      { label: 'Revenue', data: data.byDay.map((d) => d.revenue), borderColor: '#0d3b66', backgroundColor: 'rgba(13,59,102,.08)', fill: true, tension: .4, borderWidth: 2, pointRadius: 2, pointHoverRadius: 5 },
                      { label: 'Received', data: data.byDay.map((d) => d.received), borderColor: '#1e7e46', backgroundColor: 'rgba(30,126,70,.08)', fill: true, tension: .4, borderWidth: 2, pointRadius: 2, pointHoverRadius: 5 }
                    ]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } } },
                    scales: { y: { beginAtZero: true, ...axisOpts }, x: { ...axisOpts, ticks: { ...axisOpts.ticks, maxRotation: 0, maxTicksLimit: 10 } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Payment Methods</h6>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="doughnut" {...{
                  data: {
                    labels: data.byMethod.map((m) => m._id),
                    datasets: [{ data: data.byMethod.map((m) => m.total), backgroundColor: ['#1e7e46', '#1a6fb5', '#0d3b66', '#f9a825', '#6c757d'], borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false, cutout: '60%',
                    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12, font: { size: 11 } } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Top Selling Products</h6>
                <Badge bg="primary" className="rounded-pill" style={{ fontSize: '0.65rem' }}>{data.topProducts.length} items</Badge>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="bar" {...{
                  data: {
                    labels: data.topProducts.map((p) => p.name.length > 16 ? p.name.slice(0, 15) + '...' : p.name),
                    datasets: [{ label: 'Qty Sold', data: data.topProducts.map((p) => p.qtySold), backgroundColor: '#1a6fb5', borderRadius: 6, barThickness: 18 }]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => data.topProducts[items[0].dataIndex]?.name } } },
                    scales: { x: { beginAtZero: true, ...axisOpts }, y: { ...axisOpts, ticks: { ...axisOpts.ticks, font: { size: 10 } } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Sales by Category</h6>
                <Badge bg="success" className="rounded-pill" style={{ fontSize: '0.65rem' }}>{data.byCategory.length} categories</Badge>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="bar" {...{
                  data: {
                    labels: data.byCategory.map((c) => c._id.length > 14 ? c._id.slice(0, 13) + '...' : c._id),
                    datasets: [{ label: 'Revenue', data: data.byCategory.map((c) => c.revenue), backgroundColor: '#1e7e46', borderRadius: 6, barThickness: 22 }]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => data.byCategory[items[0].dataIndex]?._id } } },
                    scales: { y: { beginAtZero: true, ...axisOpts }, x: { ...axisOpts, ticks: { ...axisOpts.ticks, maxRotation: 45 } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Sales by Cashier</h6>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Cashier</th><th className="text-end">Sales</th><th className="text-end">Revenue</th></tr></thead>
                  <tbody>
                    {data.byCashier.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                    {data.byCashier.map((c) => (
                      <tr key={c._id}>
                        <td><i className="bi bi-person-circle me-1 text-muted" style={{ fontSize: '0.8rem' }} />{c.name}</td>
                        <td className="text-end">{c.count}</td>
                        <td className="text-end fw-semibold">{formatMoney(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Top Products by Revenue</h6>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Product</th><th className="text-end">Qty</th><th className="text-end">Revenue</th></tr></thead>
                  <tbody>
                    {data.topProducts.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                    {data.topProducts.map((p) => (
                      <tr key={p._id}>
                        <td className="text-truncate" style={{ maxWidth: 160 }}><i className="bi bi-box-seam me-1 text-muted" style={{ fontSize: '0.8rem' }} />{p.name}</td>
                        <td className="text-end">{p.qtySold}</td>
                        <td className="text-end fw-semibold">{formatMoney(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
        <Card.Body className="py-3">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Daily Sales Breakdown</h6>
            <InputGroup size="sm" style={{ maxWidth: 220 }}>
              <InputGroup.Text className="bg-light border-end-0"><i className="bi bi-search" style={{ fontSize: '0.75rem' }} /></InputGroup.Text>
              <Form.Control placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-light border-start-0" style={{ fontSize: '0.8rem' }} />
            </InputGroup>
          </div>
          <div className="table-responsive">
            <Table size="sm" hover className="mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-end">Sales Count</th>
                  <th className="text-end">Revenue</th>
                  <th className="text-end">Received</th>
                  <th className="text-end">Collection %</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No matching records</td></tr>}
                {paged.map((d) => {
                  const pct = d.revenue > 0 ? ((d.received / d.revenue) * 100).toFixed(0) : 0
                  return (
                    <tr key={d._id}>
                      <td><i className="bi bi-calendar3 me-1 text-muted" style={{ fontSize: '0.75rem' }} />{d._id}</td>
                      <td className="text-end">{d.count}</td>
                      <td className="text-end fw-semibold">{formatMoney(d.revenue)}</td>
                      <td className="text-end" style={{ color: '#1e7e46' }}>{formatMoney(d.received)}</td>
                      <td className="text-end">
                        <Badge bg={pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger'} className="rounded-pill" style={{ fontSize: '0.65rem', fontWeight: 500 }}>
                          {pct}%
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2 pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
              <small className="text-muted">Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</small>
              <div className="d-flex gap-1">
                <Button size="sm" variant="outline-secondary" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Prev</Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let p
                  if (totalPages <= 5) p = i + 1
                  else if (safePage <= 3) p = i + 1
                  else if (safePage >= totalPages - 2) p = totalPages - 4 + i
                  else p = safePage - 2 + i
                  return <Button key={p} size="sm" variant={p === safePage ? 'primary' : 'outline-secondary'} onClick={() => setPage(p)} style={{ fontSize: '0.75rem', padding: '2px 8px', minWidth: 28 }}>{p}</Button>
                })}
                <Button size="sm" variant="outline-secondary" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Next</Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
