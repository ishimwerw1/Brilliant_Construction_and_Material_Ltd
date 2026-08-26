import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Table, Button, Badge, Form, InputGroup } from 'react-bootstrap'
import api from '../../api/client'
import Chart from '../../components/common/Charts'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

const PAGE_SIZE = 8
const CHART_H = 280

const chartFont = { family: "'Segoe UI', system-ui, sans-serif" }
const axisOpts = { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { font: { size: 10, ...chartFont }, color: '#6b7a90' } }

const STATUS_OPTIONS = [
  ['all', 'All Status'], ['ACTIVE', 'Active'], ['PARTIALLY_PAID', 'Partially Paid'],
  ['PAID', 'Paid'], ['OVERDUE', 'Overdue'], ['CANCELLED', 'Cancelled']
]

export default function LoansReport() {
  const [report, setReport] = useState(null)
  const [loans, setLoans] = useState([])
  const [totalLoans, setTotalLoans] = useState(0)
  const [loanPage, setLoanPage] = useState(1)
  const [loanPages, setLoanPages] = useState(1)
  const [loanStats, setLoanStats] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const loadReport = () => {
    api.get('/reports/loans').then((r) => setReport(r.data.data))
  }

  const loadLoans = () => {
    const params = { page: loanPage, limit: PAGE_SIZE }
    if (search) params.search = search
    if (statusFilter !== 'all') params.status = statusFilter
    if (from) params.from = from
    if (to) params.to = to
    api.get('/loans', { params }).then((r) => {
      setLoans(r.data.data.loans)
      setTotalLoans(r.data.data.total)
      setLoanPages(r.data.data.pages)
      setLoanStats(r.data.data.stats)
    })
  }

  useEffect(loadReport, [])
  useEffect(loadLoans, [loanPage, search, statusFilter, from, to])
  useEffect(() => { setLoanPage(1) }, [search, statusFilter, from, to])

  if (!report) return <Loading full />
  const t = report.totals
  const stats = loanStats || {}

  const paidPct = t.totalGiven > 0 ? ((t.totalRepaid / t.totalGiven) * 100).toFixed(1) : 0
  const overdueAmount = report.overdueLoans.reduce((a, l) => a + l.outstandingBalance, 0)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-credit-card-2-front me-2" />Loan Report</h4>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('overdue-loans', report.overdueLoans, [
            { key: 'loanNumber', label: 'Loan ID' }, { key: 'customerName', label: 'Customer' },
            { key: 'customerPhone', label: 'Phone' }, { key: 'outstandingBalance', label: 'Outstanding' },
            { key: (r) => new Date(r.dueDate).toLocaleDateString(), label: 'Due Date' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-arrow-up-right-circle" label="Total Loans" value={formatMoney(t.totalGiven)} color="primary" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-check-circle" label="Total Repaid" value={formatMoney(t.totalRepaid)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-cash-coin" label="Outstanding" value={formatMoney(t.totalOutstanding)} color="danger" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-alarm" label="Overdue" value={report.overdueLoans.length} color="warning" sub={formatMoney(overdueAmount)} /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-percent" style={{ color: '#1e7e46', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Repayment Rate</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{paidPct}%</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-people" style={{ color: '#1a6fb5', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Active Loans</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{stats.activeCount || 0}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-hourglass-split" style={{ color: '#f9a825', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Partial</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{stats.partialCount || 0}</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-3">
              <div className="d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-check-circle-fill" style={{ color: '#1e7e46', fontSize: '0.95rem' }} />
                <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Fully Paid</span>
              </div>
              <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{stats.paidCount || 0}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={4}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Loan Status</h6>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="doughnut" {...{
                  data: {
                    labels: report.byStatus.map((s) => s._id.replace(/_/g, ' ')),
                    datasets: [{ data: report.byStatus.map((s) => s.count), backgroundColor: ['#1a6fb5', '#f9a825', '#1e7e46', '#c0392b', '#6c757d'], borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }]
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
        <Col lg={8}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Monthly Repayments</h6>
                <small className="text-muted">Repayment trend over time</small>
              </div>
              <div style={{ height: CHART_H }}>
                <Chart type="bar" {...{
                  data: {
                    labels: report.repaymentTrend.map((r) => r._id),
                    datasets: [{ label: 'Amount', data: report.repaymentTrend.map((r) => r.total), backgroundColor: '#1e7e46', borderRadius: 6, barThickness: 24 }]
                  },
                  options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ...axisOpts }, x: { ...axisOpts, ticks: { ...axisOpts.ticks, maxRotation: 0 } } }
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
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Status Breakdown</h6>
                <Badge bg="info" className="rounded-pill" style={{ fontSize: '0.65rem' }}>{report.byStatus.length} statuses</Badge>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Status</th><th className="text-end">Count</th><th className="text-end">Outstanding</th></tr></thead>
                  <tbody>
                    {report.byStatus.map((s) => (
                      <tr key={s._id}>
                        <td><StatusBadge value={s._id} /></td>
                        <td className="text-end">{s.count}</td>
                        <td className="text-end fw-semibold">{formatMoney(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>
                  <Badge bg="danger" className="rounded-pill me-1" style={{ fontSize: '0.6rem' }}>OVERDUE</Badge> Overdue Loans
                </h6>
                <Badge bg="danger" className="rounded-pill" style={{ fontSize: '0.65rem' }}>{report.overdueLoans.length} loans</Badge>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                <Table size="sm" hover responsive className="mb-0">
                  <thead><tr><th>Loan</th><th>Customer</th><th className="text-end">Balance</th><th>Due</th></tr></thead>
                  <tbody>
                    {report.overdueLoans.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-3">No overdue loans</td></tr>}
                    {report.overdueLoans.map((l) => (
                      <tr key={l._id}>
                        <td><code style={{ fontSize: '0.7rem', background: '#f0f4f8', padding: '1px 5px', borderRadius: 4 }}>{l.loanNumber}</code></td>
                        <td>
                          <div className="small fw-medium">{l.customerName}</div>
                          <small className="text-muted">{l.customerPhone}</small>
                        </td>
                        <td className="text-end fw-bold text-danger">{formatMoney(l.outstandingBalance)}</td>
                        <td className="small">{new Date(l.dueDate).toLocaleDateString()}</td>
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
            <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>All Loans</h6>
            <div className="d-flex gap-2 flex-wrap align-items-center">
              <Form.Select size="sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 130, fontSize: '0.8rem' }}>
                {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Form.Select>
              <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 130, fontSize: '0.8rem' }} />
              <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 130, fontSize: '0.8rem' }} />
              <InputGroup size="sm" style={{ width: 180 }}>
                <InputGroup.Text className="bg-light border-end-0"><i className="bi bi-search" style={{ fontSize: '0.75rem' }} /></InputGroup.Text>
                <Form.Control placeholder="Search loans..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-light border-start-0" style={{ fontSize: '0.8rem' }} />
              </InputGroup>
              <Button size="sm" variant="outline-secondary" onClick={() => { setSearch(''); setStatusFilter('all'); setFrom(''); setTo('') }} style={{ fontSize: '0.75rem' }}>
                <i className="bi bi-x-circle me-1" />Clear
              </Button>
            </div>
          </div>
          <div className="table-responsive">
            <Table size="sm" hover className="mb-0">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Product</th>
                  <th className="text-end">Total</th>
                  <th className="text-end">Paid</th>
                  <th className="text-end">Remaining</th>
                  <th className="text-center">Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {loans.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-3">No loans found</td></tr>}
                {loans.map((l) => (
                  <tr key={l._id}>
                    <td>
                      <div className="fw-medium small">{l.customerName}</div>
                    </td>
                    <td className="small text-muted">{l.customerPhone}</td>
                    <td>
                      {l.items && l.items.length > 0 ? (
                        <div>
                          {l.items.slice(0, 2).map((item, i) => (
                            <div key={i} className="small">
                              <i className="bi bi-box-seam me-1 text-muted" style={{ fontSize: '0.7rem' }} />
                              {item.productName} {item.quantity > 1 ? `x${item.quantity}` : ''}
                            </div>
                          ))}
                          {l.items.length > 2 && <small className="text-muted">+{l.items.length - 2} more</small>}
                        </div>
                      ) : <span className="text-muted small">N/A</span>}
                    </td>
                    <td className="text-end fw-semibold">{formatMoney(l.totalAmount)}</td>
                    <td className="text-end" style={{ color: '#1e7e46' }}>{formatMoney(l.amountPaid)}</td>
                    <td className="text-end fw-bold" style={{ color: l.outstandingBalance > 0 ? '#c0392b' : '#1e7e46' }}>{formatMoney(l.outstandingBalance)}</td>
                    <td className="text-center"><StatusBadge value={l.status} /></td>
                    <td className="small text-muted">{new Date(l.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {loanPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-2 pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
              <small className="text-muted">Showing {((loanPage - 1) * PAGE_SIZE) + 1}–{Math.min(loanPage * PAGE_SIZE, totalLoans)} of {totalLoans}</small>
              <div className="d-flex gap-1">
                <Button size="sm" variant="outline-secondary" disabled={loanPage <= 1} onClick={() => setLoanPage(loanPage - 1)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Prev</Button>
                {Array.from({ length: Math.min(loanPages, 5) }, (_, i) => {
                  let p
                  if (loanPages <= 5) p = i + 1
                  else if (loanPage <= 3) p = i + 1
                  else if (loanPage >= loanPages - 2) p = loanPages - 4 + i
                  else p = loanPage - 2 + i
                  return <Button key={p} size="sm" variant={p === loanPage ? 'primary' : 'outline-secondary'} onClick={() => setLoanPage(p)} style={{ fontSize: '0.75rem', padding: '2px 8px', minWidth: 28 }}>{p}</Button>
                })}
                <Button size="sm" variant="outline-secondary" disabled={loanPage >= loanPages} onClick={() => setLoanPage(loanPage + 1)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Next</Button>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
