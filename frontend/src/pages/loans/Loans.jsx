import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Form, Badge, ListGroup, Button, Modal, Alert, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const OPEN_STATUSES = ['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE']

export default function Loans() {
  const { hasPermission } = useAuth()
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
  const [successMsg, setSuccessMsg] = useState('')

  const [paying, setPaying] = useState(null)
  const [payLoans, setPayLoans] = useState([])
  const [openTotal, setOpenTotal] = useState(0)
  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH', reference: '', notes: '' })
  const [savingPay, setSavingPay] = useState(false)
  const [payError, setPayError] = useState('')

  const canRepay = hasPermission('payments.create') || hasPermission('loans.update')

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

  const startPay = async (c) => {
    setPayError('')
    try {
      const { data } = await api.get(`/loans/customer/${String(c._id)}`)
      const open = (data.data.loans || []).filter((l) => OPEN_STATUSES.includes(l.status))
      if (open.length === 0) return setPayError('This customer has no open loans to record a payment against.')
      const total = open.reduce((s, l) => s + Number(l.outstandingBalance || 0), 0)
      setPayLoans(open)
      setOpenTotal(total)
      setPayForm({ amount: String(total), method: 'CASH', reference: '', notes: '' })
      setPaying(c)
    } catch (err) {
      setPayError(getError(err))
    }
  }

  const amount = Number(payForm.amount || 0)

  const preview = useMemo(() => {
    if (!payLoans.length || amount <= 0) return null
    let remaining = amount
    const rows = []
    for (const l of [...payLoans].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
      if (remaining <= 0.001) break
      const due = Number(l.outstandingBalance)
      const applied = Math.min(remaining, due)
      remaining = Math.max(0, remaining - applied)
      rows.push({ loan: l, applied, remainingAfter: Math.max(0, due - applied) })
    }
    return { rows, leftover: remaining }
  }, [payLoans, amount])

  const isFullyPaid = Boolean(openTotal > 0 && amount > 0 && amount >= openTotal - 0.001)

  const recordPayment = async () => {
    if (!paying) return
    if (!amount || amount <= 0) return setPayError('Enter a valid amount.')
    if (amount > openTotal) return setPayError(`Amount cannot exceed the total outstanding balance of ${formatMoney(openTotal)}.`)
    setSavingPay(true)
    setPayError('')
    try {
      const { data } = await api.post(`/loans/customer/${String(paying._id)}/pay`, {
        amount,
        method: payForm.method,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined
      })
      const paidCount = data.data.loans.length
      const remaining = Number(data.data.customerOutstanding)
      setSuccessMsg(
        `Payment of ${formatMoney(amount)} recorded across ${paidCount} loan${paidCount === 1 ? '' : 's'}. ` +
        (remaining > 0 ? `Remaining balance: ${formatMoney(remaining)}.` : 'All loan debts are now fully paid off.')
      )
      setPaying(null)
      setPayLoans([])
      setOpenTotal(0)
      setPayForm({ amount: '', method: 'CASH', reference: '', notes: '' })
      load()
    } catch (err) {
      setPayError(getError(err))
    } finally {
      setSavingPay(false)
    }
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-cash-coin me-2" />Loans / Credit Management <span className="text-muted fs-6">({total} customer{customers.length === 1 ? '' : 's'})</span>
      </h4>

      {successMsg && <Alert variant="success" dismissible onClose={() => setSuccessMsg('')} className="py-2 small">{successMsg}</Alert>}

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
              <div className="d-flex gap-1">
                <Link to={`/loans/customer/${typeof c._id === 'object' ? c._id?.toString() : c._id}`} className="btn btn-sm btn-primary">
                  <i className="bi bi-eye me-1" />View
                </Link>
                {canRepay && Number(c.outstandingBalance) > 0 && (
                  <Button size="sm" variant="outline-success" onClick={() => startPay(c)}>
                    <i className="bi bi-cash-stack me-1" />Payment
                  </Button>
                )}
              </div>
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
                    {canRepay && <Button size="sm" variant="outline-success" onClick={() => startPay(c)}><i className="bi bi-cash-stack me-1" />Record Payment</Button>}
                    <Link to={`/loans/customer/${String(c._id)}`} className="btn btn-sm btn-primary">View</Link>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </Card>
        </>
      )}

      {/* Record payment */}
      <Modal show={Boolean(paying)} onHide={() => !savingPay && setPaying(null)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); recordPayment() }}>
          <Modal.Header closeButton={!savingPay}>
            <Modal.Title className="fs-6 fw-bold">Record Payment — {paying?.customerName}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {payError && <Alert variant="danger" dismissible onClose={() => setPayError('')} className="py-2 small">{payError}</Alert>}

            {payLoans.length > 0 && (
              <Alert variant="info" className="py-2 small">
                <i className="bi bi-collection me-1" />Total loan debt: <strong>{formatMoney(openTotal)}</strong> across {payLoans.length} open loan{payLoans.length === 1 ? '' : 's'}.
              </Alert>
            )}

            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Amount (RWF) *</Form.Label>
              <Form.Control type="number" min="1" max={openTotal} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required autoFocus />
            </Form.Group>

            {preview && (
              <div className="mb-2">
                <div className="small fw-semibold mb-1">How it will be applied (oldest loan first):</div>
                <Table size="sm" bordered className="small mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Loan #</th>
                      <th className="text-end">Balance</th>
                      <th className="text-end">Applied</th>
                      <th className="text-end">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={String(r.loan._id)}>
                        <td><code>{r.loan.loanNumber}</code></td>
                        <td className="text-end">{formatMoney(r.loan.outstandingBalance)}</td>
                        <td className="text-end text-success fw-semibold">{formatMoney(r.applied)}</td>
                        <td className="text-end">{formatMoney(r.remainingAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Method *</Form.Label>
              <Form.Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="MOMO">MoMo</option>
                <option value="BANK">Bank</option>
              </Form.Select>
            </Form.Group>

            {(payForm.method === 'MOMO' || payForm.method === 'BANK') && (
              <Form.Group className="mb-2">
                <Form.Label className="small">Transaction Reference (optional)</Form.Label>
                <Form.Control value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder={payForm.method === 'MOMO' ? 'MoMo TXN ID' : 'Bank slip no.'} />
              </Form.Group>
            )}

            <Form.Group className="mb-2">
              <Form.Label className="small">Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </Form.Group>

            {amount > 0 && openTotal > 0 && (
              <Alert variant={isFullyPaid ? 'success' : 'warning'} className="py-2 small mb-0">
                {isFullyPaid
                  ? <><i className="bi bi-check-circle me-1" />All loan debts will be <strong>fully paid off</strong>.</>
                  : <>After this payment the remaining total debt will be <strong>{formatMoney(Math.max(0, openTotal - amount))}</strong>.</>}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" disabled={savingPay} onClick={() => setPaying(null)}>Cancel</Button>
            <Button type="submit" variant="success" disabled={savingPay || !amount}>
              {savingPay ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Confirm Payment'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}