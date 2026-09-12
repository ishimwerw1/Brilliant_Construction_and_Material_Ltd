import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Table, Button, Alert, Modal, Form, Badge } from 'react-bootstrap'
import { useParams, useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import Loading from '../../components/common/Loading'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
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

  // Per-item actions
  const [itemPayTarget, setItemPayTarget] = useState(null)
  const [itemPayForm, setItemPayForm] = useState({ amount: '', method: 'CASH', reference: '', notes: '' })
  const [savingItemPay, setSavingItemPay] = useState(false)
  const [itemPayError, setItemPayError] = useState('')

  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ quantity: '', unitPrice: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  const [returnTarget, setReturnTarget] = useState(null)
  const [returnReason, setReturnReason] = useState('Product returned')
  const [savingReturn, setSavingReturn] = useState(false)

  const [itemFilter, setItemFilter] = useState('ALL')

  const load = () => {
    setError('')
    api.get(`/loans/customer/${customerId}`)
      .then((r) => setData(r.data.data))
      .catch((e) => { setError(getError(e)); setData(null) })
  }
  useEffect(load, [customerId])

  // Build flat item list from all loans
  const allItems = useMemo(() => {
    if (!data) return []
    const out = []
    ;(data.loans || []).forEach((loan) => {
      (loan.items || []).forEach((item, idx) => {
        const itemTotal = Number(item.totalAmount) || (Number(item.quantity) * Number(item.unitPrice))
        out.push({ loan, item, itemIndex: idx, itemTotal })
      })
    })
    return out
  }, [data])

  const displayedItems = useMemo(() => {
    if (itemFilter === 'ALL') return allItems
    if (itemFilter === 'PAID') return allItems.filter((r) => r.item.status === 'PAID')
    if (itemFilter === 'UNPAID') return allItems.filter((r) => r.item.status !== 'PAID')
    return allItems
  }, [allItems, itemFilter])

  const paidItems = useMemo(() => allItems.filter((r) => r.item.status === 'PAID'), [allItems])
  const unpaidItems = useMemo(() => allItems.filter((r) => r.item.status !== 'PAID'), [allItems])
  const totalUnpaidDebt = useMemo(() => unpaidItems.reduce((s, r) => s + (Number(r.item.outstandingBalance) || 0), 0), [unpaidItems])

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
      const { data: res } = await api.post(`/loans/customer/${customerId}/pay`, {
        amount,
        method: payForm.method,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined
      })
      const paidCount = res.data.loans.length
      const rem = Number(res.data.customerOutstanding)
      setShowPay(false)
      setSuccessMsg(
        `Payment of ${formatMoney(amount)} recorded across ${paidCount} loan${paidCount === 1 ? '' : 's'}. ` +
        (rem > 0 ? `Remaining balance: ${formatMoney(rem)}.` : 'All loan debts are now fully paid off.')
      )
      load()
    } catch (err) {
      setPayError(getError(err))
    } finally {
      setSavingPay(false)
    }
  }

  // Per-item payment
  const startItemPay = (loan, item, itemIndex) => {
    setItemPayTarget({ loan, item, itemIndex })
    setItemPayForm({ amount: String(Number(item.outstandingBalance) || 0), method: 'CASH', reference: '', notes: '' })
    setItemPayError('')
  }

  const doItemPay = async () => {
    if (!itemPayTarget) return
    const amt = Number(itemPayForm.amount || 0)
    if (!amt || amt <= 0) return setItemPayError('Enter a valid amount.')
    if (amt > Number(itemPayTarget.item.outstandingBalance) + 0.001) {
      return setItemPayError(`Amount cannot exceed ${formatMoney(itemPayTarget.item.outstandingBalance)}.`)
    }
    setSavingItemPay(true)
    setItemPayError('')
    try {
      await api.post(
        `/loans/${itemPayTarget.loan._id}/items/${itemPayTarget.itemIndex}/pay`,
        { amount: amt, method: itemPayForm.method, reference: itemPayForm.reference || undefined, notes: itemPayForm.notes || undefined }
      )
      setSuccessMsg(`Payment of ${formatMoney(amt)} recorded for "${itemPayTarget.item.productName}".`)
      setItemPayTarget(null)
      load()
    } catch (err) {
      setItemPayError(getError(err))
    } finally {
      setSavingItemPay(false)
    }
  }

  // Per-item edit
  const startEdit = (loan, item, itemIndex) => {
    setEditTarget({ loan, item, itemIndex })
    setEditForm({ quantity: String(item.quantity), unitPrice: String(item.unitPrice) })
    setEditError('')
  }

  const doEdit = async () => {
    if (!editTarget) return
    const qty = Number(editForm.quantity)
    const price = Number(editForm.unitPrice)
    if (!qty || qty <= 0) return setEditError('Quantity must be at least 1.')
    if (!Number.isFinite(price) || price < 0) return setEditError('Price is invalid.')
    setSavingEdit(true)
    setEditError('')
    try {
      await api.put(`/loans/${editTarget.loan._id}/items/${editTarget.itemIndex}`, { quantity: qty, unitPrice: price })
      setSuccessMsg(`"${editTarget.item.productName}" updated.`)
      setEditTarget(null)
      load()
    } catch (err) {
      setEditError(getError(err))
    } finally {
      setSavingEdit(false)
    }
  }

  // Per-item return
  const startReturn = (loan, item, itemIndex) => {
    setReturnTarget({ loan, item, itemIndex })
    setReturnReason('Product returned')
  }

  const doReturn = async () => {
    if (!returnTarget) return
    setSavingReturn(true)
    try {
      await api.post(`/loans/${returnTarget.loan._id}/items/${returnTarget.itemIndex}/remove`, { reason: returnReason || 'Product returned' })
      setSuccessMsg(`"${returnTarget.item.productName}" returned.`)
      setReturnTarget(null)
      load()
    } catch (err) {
      alert(getError(err))
    } finally {
      setSavingReturn(false)
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
          <Button variant="primary" onClick={print}><i className="bi bi-printer me-1" />Print Statement</Button>
        </div>
      </div>

      {data && (
        <div className="invoice-sheet shadow-sm">
          {/* Company header */}
          <div className="text-center border-bottom pb-3 mb-4">
            <h4 className="fw-bold mb-1" style={{ color: '#0d3b66' }}>BRILLIANT CONSTRUCTION AND MATERIAL LTD</h4>
            <div className="small text-muted">Customer Loan Statement — {new Date().toLocaleDateString()}</div>
          </div>

          {/* Customer info */}
          <Row className="g-2 mb-3">
            <Col md={6}>
              <div className="small"><strong>Customer:</strong> {customer.name || '-'}</div>
              <div className="small"><strong>Phone:</strong> {customer.phone || '-'}</div>
              <div className="small"><strong>Customer ID:</strong> <code>{customerIdShort}</code></div>
            </Col>
            <Col md={6} className="text-md-end">
              <div className="small"><strong>Total Loans:</strong> {totals.loanCount}</div>
              <div className="small"><strong>Products:</strong> {allItems.length} ({paidItems.length} paid, {unpaidItems.length} unpaid)</div>
            </Col>
          </Row>

          {/* Summary cards */}
          <Row className="g-3 mb-4">
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Total Borrowed</div><div className="fw-bold">{formatMoney(totals.totalAmount)}</div></Card></Col>
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Total Paid</div><div className="fw-bold text-success">{formatMoney(totals.amountPaid)}</div></Card></Col>
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Remaining</div><div className={`fw-bold ${totals.outstandingBalance > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(totals.outstandingBalance)}</div></Card></Col>
            <Col xs={6} md={3}>
              <Card body className="p-2 text-center">
                <div className="text-muted small">Overall Status</div>
                <div className="fw-bold">
                  {totals.outstandingBalance <= 0.001 ? <span className="text-success">PAID</span> : totals.amountPaid > 0 ? <span className="text-warning">PARTIALLY PAID</span> : <span className="text-danger">ACTIVE</span>}
                </div>
              </Card>
            </Col>
          </Row>

          {/* Product filter buttons */}
          <div className="d-flex gap-2 mb-2 no-print">
            {[
              { key: 'ALL', label: 'All Products', count: allItems.length, color: 'primary' },
              { key: 'PAID', label: 'Paid', count: paidItems.length, color: 'success' },
              { key: 'UNPAID', label: 'Unpaid / Partial', count: unpaidItems.length, color: 'danger' }
            ].map((f) => (
              <Button key={f.key} size="sm"
                variant={itemFilter === f.key ? f.color : 'outline-secondary'}
                onClick={() => setItemFilter(f.key)}
              >
                {f.label} <Badge bg={itemFilter === f.key ? 'light' : f.color} text={itemFilter === f.key ? f.color : 'white'} className="ms-1">{f.count}</Badge>
              </Button>
            ))}
          </div>

          {/* Products table */}
          <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66' }}>
            {itemFilter === 'ALL' ? 'Loan Products' : itemFilter === 'PAID' ? 'Paid Products' : 'Unpaid Products'}
            {itemFilter === 'UNPAID' && <span className="ms-2 text-danger fw-normal small">Remaining Debt: {formatMoney(totalUnpaidDebt)}</span>}
          </h6>
          <Table size="sm" hover responsive bordered className="mb-3 align-middle">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-center">Qty</th>
                <th className="text-end">Amount</th>
                <th className="text-end">Paid</th>
                <th className="text-end">Remaining</th>
                <th className="text-center">Status</th>
                <th className="text-end no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-3">No products.</td></tr>
              )}
              {displayedItems.map((r) => {
                const item = r.item
                return (
                  <tr key={`${r.loan._id}-${r.itemIndex}`}>
                    <td className="small fw-medium">{item.productName}</td>
                    <td className="text-center small">{item.quantity}</td>
                    <td className="text-end small">{formatMoney(r.itemTotal)}</td>
                    <td className="text-end small text-success">{formatMoney(Number(item.amountPaid) || 0)}</td>
                    <td className="text-end small fw-semibold">{formatMoney(Number(item.outstandingBalance) || 0)}</td>
                    <td className="text-center"><StatusBadge value={item.status} /></td>
                    <td className="text-end no-print">
                      <div className="d-flex gap-1 justify-content-end">
                        {canRepay && Number(item.outstandingBalance) > 0 && (
                          <Button size="sm" variant="outline-success" onClick={() => startItemPay(r.loan, item, r.itemIndex)} title="Pay">
                            <i className="bi bi-cash-stack" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline-primary" onClick={() => startEdit(r.loan, item, r.itemIndex)} title="Edit">
                          <i className="bi bi-pencil" />
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => startReturn(r.loan, item, r.itemIndex)} title="Return">
                          <i className="bi bi-arrow-return-left" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>

          {/* Totals */}
          <div className="d-flex justify-content-end mb-3">
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

          {/* Payment history */}
          <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66' }}>Payment History</h6>
          <Table size="sm" hover bordered responsive className="mb-3 align-middle">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Product</th>
                    <th>Ref</th>
                    <th>Received By</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.payments || []).length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted py-3">No payments recorded.</td></tr>
                  )}
                  {(data.payments || []).map((p) => (
                    <tr key={p._id}>
                      <td className="small fw-semibold">{p.paymentNumber}</td>
                      <td className="small">{new Date(p.createdAt).toLocaleString()}</td>
                      <td className="small fw-semibold text-success">{formatMoney(p.amount)}</td>
                      <td><StatusBadge value={p.method} /></td>
                      <td className="small">{p.loanItemName || <span className="text-muted">—</span>}</td>
                      <td className="small">{p.reference || '-'}</td>
                      <td className="small">{p.receivedBy?.fullName || '-'}</td>
                    </tr>
                  ))}
                </tbody>
          </Table>

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

      {/* ===================== Whole-customer payment modal ===================== */}
      <Modal show={showPay} onHide={() => !savingPay && setShowPay(false)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); recordPayment() }}>
          <Modal.Header closeButton={!savingPay}>
            <Modal.Title className="fs-6 fw-bold">Record Payment — {customer.name || '-'}</Modal.Title>
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
                    <tr><th>Loan #</th><th className="text-end">Balance</th><th className="text-end">Applied</th><th className="text-end">Remaining</th></tr>
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

      {/* ===================== Per-item payment modal ===================== */}
      <Modal show={Boolean(itemPayTarget)} onHide={() => !savingItemPay && setItemPayTarget(null)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); doItemPay() }}>
          <Modal.Header closeButton={!savingItemPay}>
            <Modal.Title className="fs-6 fw-bold">Pay for "{itemPayTarget?.item?.productName}"</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {itemPayError && <Alert variant="danger" dismissible onClose={() => setItemPayError('')} className="py-2 small">{itemPayError}</Alert>}
            {itemPayTarget && (
              <Alert variant="info" className="py-2 small mb-2">
                Remaining balance: <strong>{formatMoney(Number(itemPayTarget.item.outstandingBalance) || 0)}</strong>
              </Alert>
            )}
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Amount (RWF) *</Form.Label>
              <Form.Control type="number" min="1" max={Number(itemPayTarget?.item?.outstandingBalance) || 0} value={itemPayForm.amount} onChange={(e) => setItemPayForm({ ...itemPayForm, amount: e.target.value })} required autoFocus />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Method *</Form.Label>
              <Form.Select value={itemPayForm.method} onChange={(e) => setItemPayForm({ ...itemPayForm, method: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="MOMO">MoMo</option>
                <option value="BANK">Bank</option>
              </Form.Select>
            </Form.Group>
            {(itemPayForm.method === 'MOMO' || itemPayForm.method === 'BANK') && (
              <Form.Group className="mb-2">
                <Form.Label className="small fw-semibold">Transaction Reference</Form.Label>
                <Form.Control value={itemPayForm.reference} onChange={(e) => setItemPayForm({ ...itemPayForm, reference: e.target.value })} placeholder={itemPayForm.method === 'MOMO' ? 'MoMo TXN ID' : 'Bank slip no.'} />
              </Form.Group>
            )}
            <Form.Group>
              <Form.Label className="small">Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={itemPayForm.notes} onChange={(e) => setItemPayForm({ ...itemPayForm, notes: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" disabled={savingItemPay} onClick={() => setItemPayTarget(null)}>Cancel</Button>
            <Button type="submit" variant="success" disabled={savingItemPay || !itemPayForm.amount}>
              {savingItemPay ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Record Payment'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ===================== Per-item edit modal ===================== */}
      <Modal show={Boolean(editTarget)} onHide={() => !savingEdit && setEditTarget(null)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); doEdit() }}>
          <Modal.Header closeButton={!savingEdit}>
            <Modal.Title className="fs-6 fw-bold">Edit "{editTarget?.item?.productName}"</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editError && <Alert variant="danger" dismissible onClose={() => setEditError('')} className="py-2 small">{editError}</Alert>}
            {editTarget && (
              <Alert variant="info" className="py-2 small mb-2">
                Currently paid: <strong>{formatMoney(Number(editTarget.item.amountPaid) || 0)}</strong> — paid amount is preserved.
              </Alert>
            )}
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Quantity *</Form.Label>
              <Form.Control type="number" min="1" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} required autoFocus />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Unit Price (RWF) *</Form.Label>
              <Form.Control type="number" min="0" value={editForm.unitPrice} onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })} required />
            </Form.Group>
            <div className="small text-muted">
              New total: <strong>{formatMoney(Number(editForm.quantity || 0) * Number(editForm.unitPrice || 0))}</strong>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" disabled={savingEdit} onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={savingEdit}>
              {savingEdit ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ===================== Per-item return confirmation ===================== */}
      <ConfirmDialog
        show={Boolean(returnTarget)}
        title={`Return "${returnTarget?.item?.productName || ''}"`}
        message={`Remove this product from the loan? Outstanding debt of ${formatMoney(Number(returnTarget?.item?.outstandingBalance) || 0)} will be written off.`}
        confirmLabel="Confirm Return"
        loading={savingReturn}
        onClose={() => setReturnTarget(null)}
        onConfirm={doReturn}
      >
        <Form.Group>
          <Form.Label className="small">Reason</Form.Label>
          <Form.Control as="textarea" rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
        </Form.Group>
      </ConfirmDialog>
    </div>
  )
}
