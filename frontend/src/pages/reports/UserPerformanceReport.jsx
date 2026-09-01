import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Form, Button, Table, InputGroup } from 'react-bootstrap'
import api from '../../api/client'
import Chart from '../../components/common/Charts'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

const PAGE_SIZE = 8

const CHART_H = 280

const chartFont = { family: "'Segoe UI', system-ui, sans-serif" }
const axisOpts = { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { font: { size: 10, ...chartFont }, color: '#6b7a90' } }

export default function UserPerformanceReport() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = () => {
    const params = {}
    if (from) params.from = from
    if (to) params.to = to
    api.get('/reports/user-performance', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [from, to])

  useEffect(() => { setPage(1) }, [search, from])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    return data.users.filter((u) => (u.user || '').toLowerCase().includes(q))
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (!data) return <Loading full />

  const users = data.users
  const totals = users.reduce((acc, u) => ({
    orders: acc.orders + (u.orders || 0),
    sales: acc.sales + (u.sales || 0),
    expenses: acc.expenses + (u.expenses || 0),
    purchases: acc.purchases + (u.purchases || 0),
    transactionValue: acc.transactionValue + (u.transactionValue || 0)
  }), { orders: 0, sales: 0, expenses: 0, purchases: 0, transactionValue: 0 })

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-people me-2" />User Performance Report</h4>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('user-performance-report', data.users, [
            { key: 'user', label: 'User' }, { key: 'orders', label: 'Orders' },
            { key: 'sales', label: 'Sales' }, { key: 'expenses', label: 'Expenses' },
            { key: 'purchases', label: 'Purchases' }, { key: 'transactionValue', label: 'Total Transaction Value' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-people" label="Total Users" value={users.length} color="primary" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-receipt" label="Total Orders" value={totals.orders} color="info" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-stack" label="Total Sales" value={formatMoney(totals.sales)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-wallet2" label="Total Expenses" value={formatMoney(totals.expenses)} color="danger" /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col md={12}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Transaction Value by User</h6>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="bar" {...{
                  data: {
                    labels: users.map((u) => (u.user || '-').length > 16 ? u.user.slice(0, 15) + '...' : (u.user || '-')),
                    datasets: [
                      { label: 'Sales', data: users.map((u) => u.sales), backgroundColor: '#1e7e46', borderRadius: 6, barThickness: 18 },
                      { label: 'Purchases', data: users.map((u) => u.purchases), backgroundColor: '#1a6fb5', borderRadius: 6, barThickness: 18 },
                      { label: 'Expenses', data: users.map((u) => u.expenses), backgroundColor: '#c0392b', borderRadius: 6, barThickness: 18 }
                    ]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 11 } } }, tooltip: { callbacks: { title: (items) => users[items[0].dataIndex]?.user } } },
                    scales: { y: { beginAtZero: true, ...axisOpts }, x: { ...axisOpts, ticks: { ...axisOpts.ticks, maxRotation: 45 } } }
                  }
                }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
        <Card.Body className="py-3">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>User Performance</h6>
            <InputGroup size="sm" style={{ maxWidth: 220 }}>
              <InputGroup.Text className="bg-light border-end-0"><i className="bi bi-search" style={{ fontSize: '0.75rem' }} /></InputGroup.Text>
              <Form.Control placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-light border-start-0" style={{ fontSize: '0.8rem' }} />
            </InputGroup>
          </div>
          <div className="table-responsive">
            <Table size="sm" hover className="mb-0">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="text-end">Orders</th>
                  <th className="text-end">Sales</th>
                  <th className="text-end">Expenses</th>
                  <th className="text-end">Purchases</th>
                  <th className="text-end">Total Transaction Value</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">No matching records</td></tr>}
                {paged.map((u) => (
                  <tr key={u.user}>
                    <td className="text-truncate" style={{ maxWidth: 180 }}><i className="bi bi-person-circle me-1 text-muted" style={{ fontSize: '0.8rem' }} />{u.user}</td>
                    <td className="text-end">{u.orders || 0}</td>
                    <td className="text-end fw-semibold">{formatMoney(u.sales)}</td>
                    <td className="text-end">{formatMoney(u.expenses)}</td>
                    <td className="text-end">{formatMoney(u.purchases)}</td>
                    <td className="text-end fw-bold" style={{ color: '#0d3b66' }}>{formatMoney(u.transactionValue)}</td>
                  </tr>
                ))}
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