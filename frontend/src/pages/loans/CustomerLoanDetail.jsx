import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Table, Button, Alert, Modal, Form } from 'react-bootstrap'
import { useParams, useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import Loading from '../../components/common/Loading'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const OPEN_STATUSES = ['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE']

export default function CustomerLoanDetail() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [showPay, setShowPay] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH', reference: '', notes: '' })
  const [savingPay, setSavingPay] = useState(false)
  const [payError, setPayError] = useState('')

  const load = () => {
    setError('')
    api.get(`/loans/customer/${customerId}`)
      .then((r) => setData(r.data.data))
      .catch((e) => {
        setError(getError(e))
        setData(null)
      })
  }
  useEffect(load, [customerId])

  // Flatten every loan item into a single row for display and printing.
  const rows = useMemo(() => {
    if (!data) return []
    const out = []
    data.loans.forEach((loan) => {
      const items = loan.items && loan.items.length
        ? loan.items
        : [{ productName: '(no items)', quantity: 1, unitPrice: loan.totalAmount || 0 }]
      items.forEach((it) => {
        out.push({
          loan,
          date: loan.createdAt,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
          loanNumber: loan.loanNumber,
          status: loan.status
        })
      })
    })
    return out
  }, [data])

  const openLoans = useMemo(
    () => (data?.loans || []).filter((l) => OPEN_STATUSES.includes(l.status))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [data]
  )
  const openTotal = openLoans.reduce((s, l) => s + Number(l.outstandingBalance || 0), 0)
  const canRepay = hasPermission('payments.create') || hasPermission('loans.update')

  const amount = Number(payForm.amount || 0)

  const preview = useMemo(() => {
    if (!openLoans.length || amount <= 0) return null
    let remaining = amount
    const rows = []
    for (const l of openLoans) {
      if (remaining <= 0.001) break
      const due = Number(l.outstandingBalance)
      const applied = Math.min(remaining, due)
      remaining = Math.max(0, remaining - applied)
      rows.push({ loan: l, applied, remainingAfter: Math.max(0, due - applied) })
    }
    return { rows, leftover: remaining }
  }, [openLoans, amount])

  const isFullyPaid = Boolean(openTotal > 0 && amount > 0 && amount >= openTotal - 0.001)

  const startPay = () => {
    setPayError('')
    setPayForm({ amount: String(openTotal || 0), method: 'CASH', reference: '', notes: '' })
    setShowPay(true)
  }

  const recordPayment = async () => {
    if (!amount || amount <= 0) return setPayError('Enter a valid amount.')
    if (amount > openTotal) return setPayError(`Amount cannot exceed the total outstanding balance of ${formatMoney(openTotal)}.`)
    setSavingPay(true)
    setPayError('')
    try {
      const { data } = await api.post(`/loans/customer/${customerId}/pay`, {
        amount,
        method: payForm.method,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined
      })
      const paidCount = data.data.loans.length
      const remaining = Number(data.data.customerOutstanding)
      setShowPay(false)
      setSuccessMsg(
        `Payment of ${formatMoney(amount)} recorded across ${paidCount} loan${paidCount === 1 ? '' : 's'}. ` +
        (remaining > 0 ? `Remaining balance: ${formatMoney(remaining)}.` : 'All loan debts are now fully paid off.')
      )
      load()
    } catch (err) {
      setPayError(getError(err))
    } finally {
      setSavingPay(false)
    }
  }

  if (!data && !error) return <Loading full />

  const customer = data?.customer || {}
  const totals = data?.totals || { loanCount: 0, totalAmount: 0, amountPaid: 0, outstandingBalance: 0 }
  const customerIdShort = customerId && String(customerId).slice(-6).toUpperCase()

  const print = () => window.print()

  return (
    <div>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}
      {successMsg && <Alert variant="success" dismissible onClose={() => setSuccessMsg('')} className="py-2 small">{successMsg}</Alert>}

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 no-print">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-person-lines-fill me-2" />Customer Loan History
        </h4>
        <div className="d-flex gap-2">
          <Button variant="light" className="border" onClick={() => navigate('/loans')}><i className="bi bi-arrow-left me-1" />Back</Button>
          {canRepay && openLoans.length > 0 && (
            <Button variant="success" onClick={startPay}><i className="bi bi-cash-stack me-1" />Record Payment</Button>
          )}
          <Button variant="primary" onClick={print}><i className="bi bi-printer me-1" />Print Loan Statement</Button>
        </div>
      </div>

      {data && (
        <div className="invoice-sheet shadow-sm">
          {/* Company header */}
          <div className="text-center border-bottom pb-3 mb-4">
            <h4 className="fw-bold mb-1" style={{ color: '#0d3b66' }}>BRILLIANT CONSTRUCTION AND MATERIAL LTD</h4>
            <div className="small text-muted">Customer Loan Statement</div>
          </div>

          {/* Customer information */}
          <Row className="g-2 mb-4">
            <Col md={6}>
              <div className="small"><strong>Customer:</strong> {customer.name || customerName()}</div>
              <div className="small"><strong>Phone:</strong> {customer.phone || customerPhone()}</div>
              <div className="small"><strong>Customer ID:</strong> <code>{customerIdShort}</code></div>
            </Col>
            <Col md={6} className="text-md-end">
              <div className="small"><strong>Statement Date:</strong> {new Date().toLocaleDateString()}</div>
              <div className="small"><strong>Active Loans:</strong> {totals.loanCount}</div>
            </Col>
          </Row>

          {/* Customer summary cards */}
          <Row className="g-3 mb-4">
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Total Loans</div><div className="fw-bold">{totals.loanCount}</div></Card></Col>
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Total Borrowed</div><div className="fw-bold">{formatMoney(totals.totalAmount)}</div></Card></Col>
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Total Paid</div><div className="fw-bold text-success">{formatMoney(totals.amountPaid)}</div></Card></Col>
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Remaining Balance</div><div className={`fw-bold ${totals.outstandingBalance > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(totals.outstandingBalance)}</div></Card></Col>
          </Row>

          {/* Loan transactions */}
          <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66' }}>Loan Transactions</h6>
          <Table size="sm" hover responsive bordered className="mb-3">
            <thead>
              <tr>
                <th>Date</th>
                <th>Loan #</th>
                <th>Product</th>
                <th className="text-center">Quantity</th>
                <th className="text-end">Unit Price</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-3">No loan transactions.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="small text-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="small"><code>{r.loanNumber}</code></td>
                  <td className="small">{r.productName}</td>
                  <td className="text-center small">{r.quantity}</td>
                  <td className="text-end small">{formatMoney(r.unitPrice)}</td>
                  <td className="text-end fw-semibold">{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Totals */}
          <div className="d-flex justify-content-end">
            <table className="table table-sm small mb-0" style={{ maxWidth: 360 }}>
              <tbody>
                <tr>
                  <td className="text-muted">Total Amount Borrowed</td>
                  <td className="text-end fw-semibold">{formatMoney(totals.totalAmount)}</td>
                </tr>
                <tr>
                  <td className="text-muted">Total Amount Paid</td>
                  <td className="text-end fw-semibold text-success">{formatMoney(totals.amountPaid)}</td>
                </tr>
                <tr className="table-warning">
                  <td><strong>Remaining Balance</strong></td>
                  <td className="text-end fw-bold text-danger">{formatMoney(totals.outstandingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <Row className="mt-5 pt-2 no-print">
            <Col md={6}>
              <div className="small text-muted mb-5">Customer Signature</div>
              <hr />
            </Col>
            <Col md={6}>
              <div className="small text-muted mb-5">Authorized Staff / Admin Signature</div>
              <hr />
            </Col>
          </Row>
        </div>
      )}

      {/* Record payment */}
      <Modal show={showPay} onHide={() => !savingPay && setShowPay(false)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); recordPayment() }}>
          <Modal.Header closeButton={!savingPay}>
            <Modal.Title className="fs-6 fw-bold">Record Payment — {customer.name || customerName()}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {payError && <Alert variant="danger" dismissible onClose={() => setPayError('')} className="py-2 small">{payError}</Alert>}

            {openLoans.length > 0 && (
              <Alert variant="info" className="py-2 small">
                <i className="bi bi-collection me-1" />Total loan debt: <strong>{formatMoney(openTotal)}</strong> across {openLoans.length} open loan{openLoans.length === 1 ? '' : 's'}.
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
            <Button variant="light" type="button" disabled={savingPay} onClick={() => setShowPay(false)}>Cancel</Button>
            <Button type="submit" variant="success" disabled={savingPay || !amount}>
              {savingPay ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Confirm Payment'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )

  function customerName() {
    return rows.length ? rows[0].loan.customerName : 'Unknown'
  }
  function customerPhone() {
    return rows.length ? rows[0].loan.customerPhone : '-'
  }
}