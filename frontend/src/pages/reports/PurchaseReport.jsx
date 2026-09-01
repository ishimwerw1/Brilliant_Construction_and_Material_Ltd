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

const CHART_H = 280

const chartFont = { family: "'Segoe UI', system-ui, sans-serif" }
const axisOpts = { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { font: { size: 10, ...chartFont }, color: '#6b7a90' } }

const STATUS_COLORS = {
  PAID: '#1e7e46',
  PARTIALLY_PAID: '#f9a825',
  UNPAID: '#c0392b'
}

export default function PurchaseReport() {
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
    api.get('/reports/purchases', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [period, from, to])

  if (!data) return <Loading full />
  const s = data.summary

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-cart-check me-2" />Purchase Report</h4>
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
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('purchase-report', [
            ...data.bySupplier.map((sup) => ({ type: 'By Supplier', name: sup.name, total: sup.total, paid: sup.total - (sup.remaining || 0), remaining: sup.remaining || 0, count: sup.count })),
            ...data.byStatus.map((st) => ({ type: 'By Status', name: st._id, total: st.total, paid: '', remaining: st.total, count: st.count })),
            { type: 'Summary', name: 'Total Purchases', total: s.total, paid: s.paid, remaining: s.remaining, count: s.count },
            { type: 'Summary', name: 'Overdue', total: data.overdue?.total || 0, paid: '', remaining: '', count: data.overdue?.count || 0 }
          ], [
            { key: 'type', label: 'Grouping' }, { key: 'name', label: 'Item' },
            { key: 'total', label: 'Total' }, { key: 'paid', label: 'Paid' },
            { key: 'remaining', label: 'Remaining' }, { key: 'count', label: 'Count' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-cart-check" label="Total Purchases" value={formatMoney(s.total)} color="primary" sub={`${s.count} purchases`} /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-stack" label="Paid Amount" value={formatMoney(s.paid)} color="success" sub={`Cash: ${formatMoney(s.cashPurchases)}`} /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-hourglass-split" label="Remaining / Credit" value={formatMoney(s.remaining)} color="warning" sub={`Credit: ${formatMoney(s.creditPurchases)}`} /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-exclamation-triangle" label="Overdue" value={formatMoney(data.overdue?.total || 0)} color="danger" sub={`${data.overdue?.count || 0} purchases`} /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={7}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Purchases by Supplier</h6>
                <Badge bg="primary" className="rounded-pill" style={{ fontSize: '0.65rem' }}>{data.bySupplier.length} suppliers</Badge>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="bar" {...{
                  data: {
                    labels: data.bySupplier.map((sup) => sup.name.length > 14 ? sup.name.slice(0, 13) + '...' : sup.name),
                    datasets: [{ label: 'Total', data: data.bySupplier.map((sup) => sup.total), backgroundColor: '#1a6fb5', borderRadius: 6, barThickness: 18 }]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                    plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => data.bySupplier[items[0].dataIndex]?.name } } },
                    scales: { x: { beginAtZero: true, ...axisOpts }, y: { ...axisOpts, ticks: { ...axisOpts.ticks, font: { size: 10 } } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Purchases by Status</h6>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="doughnut" {...{
                  data: {
                    labels: data.byStatus.map((st) => st._id),
                    datasets: [{ data: data.byStatus.map((st) => st.total), backgroundColor: data.byStatus.map((st) => STATUS_COLORS[st._id] || '#6c757d'), borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
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
        <Col lg={5}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}><i className="bi bi-exclamation-triangle me-1" style={{ color: '#c0392b' }} />Overdue Purchases</h6>
              <div className="table-responsive" style={{ maxHeight: 260, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Item</th><th className="text-end">Outstanding</th></tr></thead>
                  <tbody>
                    <tr>
                      <td className="text-truncate" style={{ maxWidth: 180 }}>Overdue purchases ({data.overdue?.count || 0})</td>
                      <td className="text-end fw-semibold" style={{ color: '#c0392b' }}>{formatMoney(data.overdue?.total || 0)}</td>
                    </tr>
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={7}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}><i className="bi bi-shop me-1" style={{ color: '#1a6fb5' }} />By Supplier</h6>
              <div className="table-responsive" style={{ maxHeight: 260, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Supplier</th><th className="text-end">Purchases</th><th className="text-end">Outstanding</th><th className="text-end">Count</th></tr></thead>
                  <tbody>
                    {data.bySupplier.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-3">No data</td></tr>}
                    {data.bySupplier.map((sup) => (
                      <tr key={sup.name}>
                        <td className="text-truncate" style={{ maxWidth: 180 }}><i className="bi bi-shop me-1 text-muted" style={{ fontSize: '0.8rem' }} />{sup.name}</td>
                        <td className="text-end">{formatMoney(sup.total)}</td>
                        <td className="text-end">
                          {sup.remaining > 0 ? <Badge bg="warning" className="rounded-pill" style={{ fontSize: '0.65rem', fontWeight: 500 }}>{formatMoney(sup.remaining)}</Badge> : <span className="text-muted">–</span>}
                        </td>
                        <td className="text-end">{sup.count}</td>
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
          <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>By Status</h6>
          <div className="table-responsive">
            <Table size="sm" hover className="mb-0">
              <thead><tr><th>Status</th><th className="text-end">Purchases</th><th className="text-end">Count</th></tr></thead>
              <tbody>
                {data.byStatus.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                {data.byStatus.map((st) => (
                  <tr key={st._id}>
                    <td><Badge bg={st._id === 'PAID' ? 'success' : st._id === 'PARTIALLY_PAID' ? 'warning' : 'danger'} className="rounded-pill" style={{ fontSize: '0.65rem', fontWeight: 500 }}>{st._id}</Badge></td>
                    <td className="text-end fw-semibold">{formatMoney(st.total)}</td>
                    <td className="text-end">{st.count}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  )
}