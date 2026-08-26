import { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Table, Badge } from 'react-bootstrap'
import api from '../../api/client'
import Chart from '../../components/common/Charts'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

const PERIODS = [
  ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['year', 'This Year'], ['custom', 'Custom']
]

export default function SalesReport() {
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState(null)

  const load = () => {
    const params = {}
    if (period === 'custom') {
      if (from) params.from = from
      if (to) params.to = to
    } else params.period = period
    api.get('/reports/sales', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [period, from, to])

  if (!data) return <Loading full />
  const s = data.summary

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-graph-up-arrow me-2" />Sales Report</h4>
        <div className="d-flex gap-2 flex-wrap">
          <Form.Select size="sm" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 150 }}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Form.Select>
          {period === 'custom' && (
            <>
              <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
              <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />
            </>
          )}
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('sales-report', data.byDay, [
            { key: '_id', label: 'Date' }, { key: 'count', label: 'Sales Count' },
            { key: 'revenue', label: 'Revenue' }, { key: 'received', label: 'Received' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={3}><StatCard icon="bi-receipt" label="Total Sales" value={s.count} color="primary" /></Col>
        <Col md={3}><StatCard icon="bi-cash-stack" label="Revenue" value={formatMoney(s.revenue)} color="success" /></Col>
        <Col md={3}><StatCard icon="bi-wallet2" label="Amount Received" value={formatMoney(s.received)} color="info" /></Col>
        <Col md={3}><StatCard icon="bi-cash-coin" label="Outstanding (Credit)" value={formatMoney(s.outstanding)} color="danger" sub={`Discounts given: ${formatMoney(s.discounts)}`} /></Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={8}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold">Revenue by Day</Card.Title>
            <Chart type="line" {...{
              data: {
                labels: data.byDay.map((d) => d._id),
                datasets: [
                  { label: 'Revenue', data: data.byDay.map((d) => d.revenue), borderColor: '#0d3b66', backgroundColor: 'rgba(13,59,102,.12)', fill: true, tension: .35 },
                  { label: 'Received', data: data.byDay.map((d) => d.received), borderColor: '#1e7e46', tension: .35 }
                ]
              },
              options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }
            }} height={110} />
          </Card>
        </Col>
        <Col lg={4}>
          <Card body className="h-100">
            <Card.Title className="fs-6 fw-semibold">By Payment Method</Card.Title>
            <Chart type="doughnut" {...{
              data: {
                labels: data.byMethod.map((m) => m._id),
                datasets: [{ data: data.byMethod.map((m) => m.total), backgroundColor: ['#1e7e46', '#1a6fb5', '#0d3b66', '#f9a825', '#6c757d'], borderWidth: 0 }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            }} />
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={4}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold">Top Selling Products</Card.Title>
            <div style={{ maxHeight: Math.max(200, data.topProducts.length * 36), overflowY: 'auto' }}>
              <Chart type="bar" {...{
                data: {
                  labels: data.topProducts.map((p) => p.name.slice(0, 14)),
                  datasets: [{ data: data.topProducts.map((p) => p.qtySold), backgroundColor: '#1a6fb5', borderRadius: 4 }]
                },
                options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
              }} />
            </div>
          </Card>
        </Col>
        <Col lg={4}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold">Sales by Cashier</Card.Title>
            <Table size="sm" hover className="mb-0">
              <thead><tr><th>Cashier</th><th>Sales</th><th>Revenue</th></tr></thead>
              <tbody>
                {data.byCashier.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                {data.byCashier.map((c) => (
                  <tr key={c._id}><td>{c.name}</td><td>{c.count}</td><td>{formatMoney(c.revenue)}</td></tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={4}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold">Sales by Category</Card.Title>
            <Table size="sm" hover className="mb-0">
              <thead><tr><th>Category</th><th>Qty</th><th>Revenue</th></tr></thead>
              <tbody>
                {data.byCategory.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                {data.byCategory.map((c) => (
                  <tr key={c._id}><td><Badge bg="" className="badge-soft-primary">{c._id}</Badge></td><td>{c.qtySold}</td><td>{formatMoney(c.revenue)}</td></tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>

      <Card body>
        <Card.Title className="fs-6 fw-semibold">Daily Breakdown</Card.Title>
        <div className="table-responsive" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <Table size="sm" striped hover className="mb-0">
            <thead><tr><th>Date</th><th>Sales Count</th><th>Revenue</th><th>Received</th></tr></thead>
            <tbody>
              {data.byDay.map((d) => (
                <tr key={d._id}>
                  <td>{d._id}</td><td>{d.count}</td>
                  <td>{formatMoney(d.revenue)}</td><td>{formatMoney(d.received)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
