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

export default function ExpenseReport() {
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
    api.get('/reports/expenses', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [period, from, to])

  useEffect(() => { setPage(1) }, [search, period])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    return data.byDay.filter((d) =>
      d._id.toLowerCase().includes(q) ||
      String(d.count).includes(q) ||
      String(d.total).includes(q)
    )
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  if (!data) return <Loading full />
  const s = data.summary

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-wallet2 me-2" />Expense Report</h4>
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
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('expense-report', data.byDay, [
            { key: '_id', label: 'Date' }, { key: 'count', label: 'Expense Count' }, { key: 'total', label: 'Total' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-wallet2" label="Total Expenses" value={formatMoney(s.total)} color="danger" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-receipt" label="Number of Expenses" value={s.count} color="primary" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-tags" label="Categories" value={data.byCategory.length} color="warning" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-people" label="Recorded By" value={data.byUser.length} color="info" /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={8}>
          <Card style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Daily Expense Trend</h6>
                <small className="text-muted">Expenses per day</small>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="bar" {...{
                  data: {
                    labels: data.byDay.map((d) => d._id),
                    datasets: [{ label: 'Expenses', data: data.byDay.map((d) => d.total), backgroundColor: '#c0392b', borderRadius: 6, barThickness: 18, borderWidth: 0 }]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
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
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Expenses by User</h6>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="doughnut" {...{
                  data: {
                    labels: data.byUser.map((u) => u.name),
                    datasets: [{ data: data.byUser.map((u) => u.total), backgroundColor: ['#0d3b66', '#1a6fb5', '#1e7e46', '#f9a825', '#c0392b', '#6f42c1', '#20c997', '#fd7e14'], borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
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
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Expenses by Category</h6>
                <Badge bg="danger" className="rounded-pill" style={{ fontSize: '0.65rem' }}>{data.byCategory.length} categories</Badge>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="bar" {...{
                  data: {
                    labels: data.byCategory.map((c) => c._id.length > 14 ? c._id.slice(0, 13) + '...' : c._id),
                    datasets: [{ label: 'Total', data: data.byCategory.map((c) => c.total), backgroundColor: '#c0392b', borderRadius: 6, barThickness: 22 }]
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
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Expenses by User</h6>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>User</th><th className="text-end">Count</th><th className="text-end">Total</th></tr></thead>
                  <tbody>
                    {data.byUser.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No data</td></tr>}
                    {data.byUser.map((u) => (
                      <tr key={u.name}>
                        <td><i className="bi bi-person-circle me-1 text-muted" style={{ fontSize: '0.8rem' }} />{u.name}</td>
                        <td className="text-end">{u.count}</td>
                        <td className="text-end fw-semibold">{formatMoney(u.total)}</td>
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
            <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Daily Expenses Breakdown</h6>
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
                  <th className="text-end">Expense Count</th>
                  <th className="text-end">Total Expenses</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No matching records</td></tr>}
                {paged.map((d) => (
                  <tr key={d._id}>
                    <td><i className="bi bi-calendar3 me-1 text-muted" style={{ fontSize: '0.75rem' }} />{d._id}</td>
                    <td className="text-end">{d.count}</td>
                    <td className="text-end fw-semibold" style={{ color: '#c0392b' }}>{formatMoney(d.total)}</td>
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