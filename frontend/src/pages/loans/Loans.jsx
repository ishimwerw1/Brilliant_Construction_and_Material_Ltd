import { useCallback, useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Badge } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'

export default function Loans() {
  const [loans, setLoans] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      if (status !== 'ALL') params.status = status
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/loans', { params })
      setLoans(data.data.loans)
      setStats(data.data.stats)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, status, from, to])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-cash-coin me-2" />Loans / Credit Management <span className="text-muted fs-6">({total})</span>
      </h4>

      {stats && (
        <Row className="g-3 mb-4">
          <Col xl={3} md={6}><StatCard icon="bi-cash-coin" label="Total Outstanding Debt" value={formatMoney(stats.totalOutstanding)} color="danger" sub={`${stats.activeCount + stats.partialCount + stats.overdueCount} open loans`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-alarm" label="Overdue Loans" value={formatMoney(stats.overdueAmount)} color="warning" sub={`${stats.overdueCount} loan(s) past due`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-arrow-up-right-circle" label="Total Credit Given" value={formatMoney(stats.totalCredit)} color="primary" sub={`${stats.totalLoans} loans total`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-check-circle" label="Total Repaid" value={formatMoney(stats.totalRepaid)} color="success" sub={`${stats.paidCount} fully paid · ${stats.partialCount} partial`} /></Col>
        </Row>
      )}

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control size="sm" placeholder="Search customer, phone, loan # or sale #..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 280 }} />
          <Form.Select size="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ maxWidth: 170 }}>
            {['ALL', 'ACTIVE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
            ))}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'loanNumber', label: 'Loan ID', render: (l) => (
              <Link to={`/loans/${l._id}`} className="fw-semibold text-decoration-none" style={{ color: '#0d3b66' }}>{l.loanNumber}</Link>
            )},
            { key: 'customerName', label: 'Customer', render: (l) => (
              <span className="small">{l.customerName}<br /><small className="text-muted">{l.customerPhone}</small></span>
            )},
            { key: 'saleNumber', label: 'Sale', render: (l) => l.sale?.saleNumber ? (
              <Link to={`/sales/${typeof l.sale === 'object' ? l.sale._id : ''}`} className="small text-decoration-none">{l.saleNumber}</Link>
            ) : <code className="small">{l.saleNumber}</code> },
            { key: 'items', label: 'Products', render: (l) => (
              <span className="small text-muted">{l.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ').slice(0, 60)}{l.items.length ? '...' : ''}</span>
            )},
            { key: 'totalAmount', label: 'Total', render: (l) => formatMoney(l.totalAmount) },
            { key: 'amountPaid', label: 'Paid', render: (l) => <span className="text-success fw-semibold">{formatMoney(l.amountPaid)}</span> },
            { key: 'outstandingBalance', label: 'Remaining', render: (l) => (
              <strong className={l.outstandingBalance > 0 ? 'text-danger' : 'text-success'}>{formatMoney(l.outstandingBalance)}</strong>
            )},
            { key: 'dueDate', label: 'Due Date', render: (l) => {
              if (!l.dueDate) return '-'
              const overdue = new Date(l.dueDate) < new Date() && !['PAID', 'CANCELLED'].includes(l.status)
              return <span className={`small ${overdue ? 'text-danger fw-bold' : ''}`}>{new Date(l.dueDate).toLocaleDateString()}</span>
            }},
            { key: 'status', label: 'Status', render: (l) => <StatusBadge value={l.status} /> },
            { key: 'actions', label: '', render: (l) => (
              <Link to={`/loans/${l._id}`} className="btn btn-sm btn-light border"><i className="bi bi-eye" /></Link>
            )}
          ]}
          data={loans}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {stats && stats.overdueCount > 0 && status === 'ALL' && (
        <>
          <h5 className="fw-bold mt-4 mb-2"><Badge bg="" className="badge-soft-danger">OVERDUE</Badge> Overdue Loans</h5>
          <Card body>
            <DataTable
              columns={[
                { key: 'loanNumber', label: 'Loan ID' },
                { key: 'customerName', label: 'Customer', render: (l) => `${l.customerName} (${l.customerPhone})` },
                { key: 'outstandingBalance', label: 'Remaining', render: (l) => <strong className="text-danger">{formatMoney(l.outstandingBalance)}</strong> },
                { key: 'dueDate', label: 'Due Date', render: (l) => new Date(l.dueDate).toLocaleDateString() },
                { key: 'actions', label: '', render: (l) => <Link to={`/loans/${l._id}`} className="btn btn-sm btn-primary">Repay</Link> }
              ]}
              data={loans.filter((l) => l.status === 'OVERDUE')}
              loading={false}
              page={1}
              pages={1}
              emptyText="No overdue loans"
            />
          </Card>
        </>
      )}
    </div>
  )
}
