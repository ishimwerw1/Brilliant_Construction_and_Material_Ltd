import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Form, Alert, Modal, Badge } from 'react-bootstrap'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api, { getError } from '../../api/client'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Loading from '../../components/common/Loading'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

export default function LoanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [data, setData] = useState(null)
  const [showRepay, setShowRepay] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [showDueDate, setShowDueDate] = useState(false)
  const [form, setForm] = useState({ amount: '', method: 'CASH', reference: '', notes: '' })
  const [cancelReason, setCancelReason] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Per-item modal states
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

  // Filtered views
  const [itemFilter, setItemFilter] = useState('ALL') // 'ALL' | 'PAID' | 'UNPAID'

  const load = () => {
    api.get(`/loans/${id}`).then((r) => setData(r.data.data)).catch(() => navigate('/loans'))
  }
  useEffect(load, [id, navigate])

  if (!data) return <Loading full />
  const { loan, payments } = data
  const canRepay = hasPermission('payments.create') || hasPermission('loans.update')
  const canCancelLoan = hasPermission('loans.cancel')

  const activeItems = (loan.items || []).filter((it) => (it.status || 'ACTIVE') !== 'REMOVED')
  const paidItems = activeItems.filter((it) => it.status === 'PAID')
  const unpaidItems = activeItems.filter((it) => it.status !== 'PAID')
  const displayedItems = itemFilter === 'PAID' ? paidItems : itemFilter === 'UNPAID' ? unpaidItems : activeItems

  const startRepay = () => {
    setForm({ amount: loan.outstandingBalance.toString(), method: 'CASH', reference: '', notes: '' })
    setError('')
    setShowRepay(true)
  }

  const proceedToConfirm = (e) => {
    e.preventDefault()
    const amt = Number(form.amount)
    if (!amt || amt <= 0) return setError('Enter a valid amount.')
    if (amt > loan.outstandingBalance) return setError(`Amount cannot exceed ${formatMoney(loan.outstandingBalance)}.`)
    setShowRepay(false)
    setShowConfirm(true)
  }

  const doRepay = async () => {
    setSaving(true)
    try {
      await api.post(`/loans/${loan._id}/repay`, {
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || undefined,
        notes: form.notes || undefined
      })
      setShowConfirm(false)
      setSuccessMsg(`Repayment of ${formatMoney(Number(form.amount))} recorded.`)
      load()
    } catch (err) {
      setError(getError(err))
      setShowConfirm(false)
      setShowRepay(true)
    } finally {
      setSaving(false)
    }
  }

  const doCancelLoan = async () => {
    setSaving(true)
    try {
      await api.put(`/loans/${loan._id}/cancel`, { reason: cancelReason })
      setShowCancel(false)
      load()
    } catch (err) {
      alert(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const saveDueDate = async () => {
    setSaving(true)
    try {
      await api.put(`/loans/${loan._id}/due-date`, { dueDate: newDueDate })
      setShowDueDate(false)
      load()
    } catch (err) {
      alert(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const doDeleteLoan = async () => {
    setDeleteLoading(true)
    try {
      const { data: res } = await api.delete(`/loans/${loan._id}`)
      alert(res.message)
      navigate('/loans')
    } catch (err) {
      alert(getError(err))
      setShowDelete(false)
    } finally {
      setDeleteLoading(false)
    }
  }

  // --- Per-item actions ---
  const startItemPay = (item, idx) => {
    setItemPayTarget({ item, idx })
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
        `/loans/${loan._id}/items/${itemPayTarget.idx}/pay`,
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

  const startEditItem = (item, idx) => {
    setEditTarget({ item, idx })
    setEditForm({ quantity: String(item.quantity), unitPrice: String(item.unitPrice) })
    setEditError('')
  }

  const doEditItem = async () => {
    if (!editTarget) return
    const qty = Number(editForm.quantity)
    const price = Number(editForm.unitPrice)
    if (!qty || qty <= 0) return setEditError('Quantity must be at least 1.')
    if (!Number.isFinite(price) || price < 0) return setEditError('Price is invalid.')
    setSavingEdit(true)
    setEditError('')
    try {
      await api.put(`/loans/${loan._id}/items/${editTarget.idx}`, { quantity: qty, unitPrice: price })
      setSuccessMsg(`"${editTarget.item.productName}" updated.`)
      setEditTarget(null)
      load()
    } catch (err) {
      setEditError(getError(err))
    } finally {
      setSavingEdit(false)
    }
  }

  const startReturnItem = (item, idx) => {
    setReturnTarget({ item, idx })
    setReturnReason('Product returned')
  }

  const doReturnItem = async () => {
    if (!returnTarget) return
    setSavingReturn(true)
    try {
      await api.post(`/loans/${loan._id}/items/${returnTarget.idx}/remove`, { reason: returnReason || 'Product returned' })
      setSuccessMsg(`"${returnTarget.item.productName}" returned.`)
      setReturnTarget(null)
      load()
    } catch (err) {
      alert(getError(err))
    } finally {
      setSavingReturn(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-cash-coin me-2" />{loan.loanNumber} <StatusBadge value={loan.status} />
        </h4>
        <div className="d-flex gap-2">
          <Button variant="light" className="border" onClick={() => navigate('/loans')}><i className="bi bi-arrow-left me-1" />Back</Button>
          {canRepay && !['PAID', 'CANCELLED'].includes(loan.status) && (
            <Button variant="success" onClick={startRepay}><i className="bi bi-cash-stack me-1" />Record Repayment</Button>
          )}
          {hasPermission('loans.update') && !['PAID', 'CANCELLED'].includes(loan.status) && (
            <Button variant="outline-primary" onClick={() => { setNewDueDate(loan.dueDate?.slice(0, 10) || ''); setShowDueDate(true) }}>
              <i className="bi bi-calendar-event me-1" />Due Date
            </Button>
          )}
          {canCancelLoan && !['PAID', 'CANCELLED'].includes(loan.status) && (
            <Button variant="outline-danger" onClick={() => setShowCancel(true)}><i className="bi bi-x-circle me-1" />Cancel Loan</Button>
          )}
          {hasPermission('loans.delete') && loan.status !== 'PAID' && (
            <Button variant="outline-danger" className="border" onClick={() => setShowDelete(true)}>
              <i className="bi bi-trash me-1" />Delete
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}
      {successMsg && <Alert variant="success" dismissible onClose={() => setSuccessMsg('')} className="py-2 small">{successMsg}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Total Amount</div><div className="fs-5 fw-bold">{formatMoney(loan.totalAmount)}</div></Card></Col>
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Amount Paid</div><div className="fs-5 fw-bold text-success">{formatMoney(loan.amountPaid)}</div></Card></Col>
        <Col md={3}><Card body className="text-center bg-light"><div className="text-muted small">Outstanding Balance</div><div className={`fs-5 fw-bold ${loan.outstandingBalance > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(loan.outstandingBalance)}</div></Card></Col>
        <Col md={3}><Card body className="text-center"><div className="text-muted small">Due Date</div><div className={`fs-6 fw-bold ${new Date(loan.dueDate) < new Date() && !['PAID', 'CANCELLED'].includes(loan.status) ? 'text-danger' : ''}`}>{loan.dueDate ? new Date(loan.dueDate).toLocaleDateString() : '-'}</div></Card></Col>
      </Row>

      <Row className="g-3">
        <Col lg={7}>
          <Card className="mb-3">
            <Card.Header className="bg-white fw-semibold small d-flex justify-content-between align-items-center">
              <span><i className="bi bi-box-seam me-2 text-primary" />Loan Products ({activeItems.length})</span>
              <div className="d-flex gap-1">
                {['ALL', 'PAID', 'UNPAID'].map((f) => (
                  <Button key={f} size="sm"
                    variant={itemFilter === f ? 'primary' : 'outline-secondary'}
                    onClick={() => setItemFilter(f)}
                    style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                  >
                    {f}
                    {f === 'PAID' && <Badge bg="success" className="ms-1 rounded-pill" style={{ fontSize: '0.6rem' }}>{paidItems.length}</Badge>}
                    {f === 'UNPAID' && <Badge bg="danger" className="ms-1 rounded-pill" style={{ fontSize: '0.6rem' }}>{unpaidItems.length}</Badge>}
                  </Button>
                ))}
              </div>
            </Card.Header>
            <Table size="sm" responsive className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-center">Qty</th>
                  <th className="text-end">Price</th>
                  <th className="text-end">Paid</th>
                  <th className="text-end">Remaining</th>
                  <th className="text-center">Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item) => {
                  const itemIdx = (loan.items || []).indexOf(item)
                  return (
                    <tr key={itemIdx}>
                      <td className="small fw-medium">{item.productName}</td>
                      <td className="text-center small">{item.quantity}</td>
                      <td className="text-end small">{formatMoney(Number(item.unitPrice))}</td>
                      <td className="text-end small text-success">{formatMoney(Number(item.amountPaid) || 0)}</td>
                      <td className="text-end small fw-semibold">{formatMoney(Number(item.outstandingBalance) || 0)}</td>
                      <td className="text-center"><StatusBadge value={item.status} /></td>
                      <td className="text-end">
                        <div className="d-flex gap-1 justify-content-end">
                          {canRepay && Number(item.outstandingBalance) > 0 && (
                            <Button size="sm" variant="outline-success" onClick={() => startItemPay(item, itemIdx)} title={`Pay for ${item.productName}`}>
                              <i className="bi bi-cash-stack" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline-primary" onClick={() => startEditItem(item, itemIdx)} title="Edit">
                            <i className="bi bi-pencil" />
                          </Button>
                          {canCancelLoan && (item.status || 'ACTIVE') !== 'REMOVED' && (
                            <Button size="sm" variant="outline-danger" onClick={() => startReturnItem(item, itemIdx)} title="Return / Remove">
                              <i className="bi bi-arrow-return-left" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {displayedItems.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted py-3">
                    {itemFilter === 'ALL' ? 'No active products.' : itemFilter === 'PAID' ? 'No fully paid products.' : 'No unpaid products.'}
                  </td></tr>
                )}
              </tbody>
            </Table>
          </Card>

          <Card>
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-clock-history me-2 text-success" />Repayment History ({payments.length})</Card.Header>
            <Table size="sm" hover responsive className="mb-0 align-middle">
              <thead><tr><th>Receipt #</th><th>Date</th><th>Amount</th><th>Method</th><th>Product</th><th>Ref</th><th>Received By</th></tr></thead>
              <tbody>
                {payments.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-3">No repayments yet</td></tr>}
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td className="fw-semibold">{p.paymentNumber}</td>
                    <td className="small">{new Date(p.createdAt).toLocaleString()}</td>
                    <td className="fw-semibold text-success">{formatMoney(p.amount)}</td>
                    <td><StatusBadge value={p.method} /></td>
                    <td className="small">{p.loanItemName || <span className="text-muted">—</span>}</td>
                    <td className="small">{p.reference || '-'}</td>
                    <td className="small">{p.receivedBy?.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>

        <Col lg={5}>
          <Card>
            <Card.Header className="bg-white fw-semibold small">Customer & Sale Information</Card.Header>
            <Card.Body className="py-1">
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Customer</span>
                <span className="small fw-semibold">{loan.customerName}</span>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Phone</span>
                <span className="small"><code>{loan.customerPhone}</code></span>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Linked Sale</span>
                <Link to={`/sales/${typeof loan.sale === 'object' ? loan.sale._id : ''}`} className="small fw-semibold">{loan.saleNumber}</Link>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Loan Date</span>
                <span className="small">{new Date(loan.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="d-flex justify-content-between border-bottom py-2">
                <span className="text-muted small">Created By</span>
                <span className="small">{loan.createdBy?.fullName || '-'}</span>
              </div>
              {loan.cancelReason && (
                <div className="d-flex justify-content-between py-2">
                  <span className="text-muted small">Cancel Reason</span>
                  <span className="small fst-italic">{loan.cancelReason}</span>
                </div>
              )}
            </Card.Body>
          </Card>

          {loan.sale && typeof loan.sale === 'object' && (
            <Card body className="mt-3 small text-muted">
              <strong className="text-dark d-block mb-1">Original sale summary</strong>
              Total: {formatMoney(loan.sale.total)} · Paid on sale: {formatMoney(loan.sale.amountPaid)} · Method: {loan.sale.paymentMethod}
            </Card>
          )}
        </Col>
      </Row>

      {/* Repayment entry */}
      <Modal show={showRepay} onHide={() => !saving && setShowRepay(false)} centered backdrop="static">
        <Form onSubmit={proceedToConfirm}>
          <Modal.Header closeButton={!saving}><Modal.Title className="fs-6 fw-bold">Record Repayment — {loan.loanNumber}</Modal.Title></Modal.Header>
          <Modal.Body>
            <Alert variant="info" className="py-2 small">
              Outstanding balance: <strong>{formatMoney(loan.outstandingBalance)}</strong>
            </Alert>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Amount (RWF) *</Form.Label>
              <Form.Control type="number" min="1" max={loan.outstandingBalance} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required autoFocus />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Method *</Form.Label>
              <Form.Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="MOMO">MoMo</option>
                <option value="BANK">Bank</option>
              </Form.Select>
            </Form.Group>
            {(form.method === 'MOMO' || form.method === 'BANK') && (
              <Form.Group className="mb-2">
                <Form.Label className="small fw-semibold">Transaction Reference</Form.Label>
                <Form.Control value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder={form.method === 'MOMO' ? 'MoMo TXN ID' : 'Bank slip no.'} />
              </Form.Group>
            )}
            <Form.Group>
              <Form.Label className="small">Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" onClick={() => setShowRepay(false)}>Cancel</Button>
            <Button type="submit">Continue</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={showConfirm}
        title="Confirm Loan Repayment"
        confirmLabel="Confirm Payment"
        loading={saving}
        onClose={() => setShowConfirm(false)}
        onConfirm={doRepay}
      >
        <table className="table table-sm small mb-0">
          <tbody>
            <tr><td>Customer</td><td className="text-end fw-semibold">{loan.customerName} ({loan.customerPhone})</td></tr>
            <tr><td>Previous Balance</td><td className="text-end">{formatMoney(loan.outstandingBalance)}</td></tr>
            <tr><td>Payment</td><td className="text-end fw-bold text-success">{formatMoney(Number(form.amount))} ({form.method})</td></tr>
            <tr className="table-warning"><td><strong>Remaining</strong></td><td className="text-end fw-bold text-danger">{formatMoney(Math.max(0, loan.outstandingBalance - Number(form.amount || 0)))}</td></tr>
          </tbody>
        </table>
      </ConfirmDialog>

      <ConfirmDialog
        show={showCancel}
        title="Cancel Loan"
        message={`Cancel ${loan.loanNumber}? The remaining ${formatMoney(loan.outstandingBalance)} will be written off. Payment history is preserved.`}
        confirmLabel="Cancel Loan"
        loading={saving}
        onClose={() => setShowCancel(false)}
        onConfirm={doCancelLoan}
      >
        <Form.Control as="textarea" rows={2} placeholder="Reason (required)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </ConfirmDialog>

      <ConfirmDialog
        show={showDelete}
        title="Permanently Delete Loan"
        message={`Delete ${loan.loanNumber} (${formatMoney(loan.totalAmount)})? The customer's outstanding balance is reduced by ${formatMoney(loan.outstandingBalance)}. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteLoading}
        onClose={() => setShowDelete(false)}
        onConfirm={doDeleteLoan}
      />

      <Modal show={showDueDate} onHide={() => setShowDueDate(false)} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">Update Due Date</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label className="small fw-semibold">New Due Date</Form.Label>
            <Form.Control type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowDueDate(false)}>Cancel</Button>
          <Button onClick={saveDueDate} disabled={saving || !newDueDate}>Save</Button>
        </Modal.Footer>
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
        <Form onSubmit={(e) => { e.preventDefault(); doEditItem() }}>
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
        message={`Remove this product from the loan? Outstanding debt of ${formatMoney(Number(returnTarget?.item?.outstandingBalance) || 0)} will be written off. Payment history for this product is preserved.`}
        confirmLabel="Confirm Return"
        loading={savingReturn}
        onClose={() => setReturnTarget(null)}
        onConfirm={doReturnItem}
      >
        <Form.Group>
          <Form.Label className="small">Reason</Form.Label>
          <Form.Control as="textarea" rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
        </Form.Group>
      </ConfirmDialog>
    </div>
  )
}
