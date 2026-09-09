import { useCallback, useEffect, useState } from 'react'
import { Card, Row, Col, Form, Badge, ListGroup } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'

export default function Loans() {
  const [customers, setCustomers] = useState([])
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
      setCustomers(data.data.customers || [])
      setStats(data.data.stats)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, status, from, to])

  useEffect(() => { load() }, [load])

  const loanStatusCell = (c) => (
    <span className="small">{c.loanCount} loan{c.loanCount === 1 ? '' : 's'}</span>
  )

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-cash-coin me-2" />Loans / Credit Management <span className="text-muted fs-6">({total} customer{customers.length === 1 ? '' : 's'})</span>
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
          <Form.Control size="sm" placeholder="Search customer name or phone..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 280 }} />
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
            { key: 'customerName', label: 'Customer', render: (c) => (
              <span className="small fw-semibold">{c.customerName || 'Unknown customer'}</span>
            )},
            { key: 'customerPhone', label: 'Phone', render: (c) => <code className="small">{c.customerPhone || '-'}</code> },
            { key: 'loanCount', label: 'Total Loans', render: loanStatusCell },
            { key: 'totalAmount', label: 'Total Debt', render: (c) => formatMoney(c.totalAmount) },
            { key: 'amountPaid', label: 'Paid', render: (c) => <span className="text-success fw-semibold">{formatMoney(c.amountPaid)}</span> },
            { key: 'outstandingBalance', label: 'Remaining', render: (c) => (
              <strong className={c.outstandingBalance > 0 ? 'text-danger' : 'text-success'}>{formatMoney(c.outstandingBalance)}</strong>
            )},
            { key: 'actions', label: 'Action', render: (c) => (
              <Link to={`/loans/customer/${typeof c._id === 'object' ? c._id?.toString() : c._id}`} className="btn btn-sm btn-primary">
                <i className="bi bi-eye me-1" />View
              </Link>
            )}
          ]}
          data={customers}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {stats && stats.overdueCount > 0 && status === 'ALL' && (
        <>
          <h5 className="fw-bold mt-4 mb-2"><Badge bg="" className="badge-soft-danger">OVERDUE</Badge> Customers with Overdue Loans</h5>
          <Card body>
            <ListGroup variant="flush">
              {customers.filter((c) => c.outstandingBalance > 0).slice(0, 5).map((c) => (
                <ListGroup.Item key={String(c._id)} className="d-flex justify-content-between align-items-center px-0">
                  <div>
                    <span className="fw-semibold small">{c.customerName}</span>
                    <span className="text-muted ms-2 small"><code>{c.customerPhone}</code></span>
                  </div>
                  <div className="d-flex gap-2 align-items-center">
                    <strong className="text-danger">{formatMoney(c.outstandingBalance)}</strong>
                    <Link to={`/loans/customer/${String(c._id)}`} className="btn btn-sm btn-primary">View &amp; Repay</Link>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </>
      )}
    </div>
  )
}
