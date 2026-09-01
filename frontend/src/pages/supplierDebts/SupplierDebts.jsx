import { useCallback, useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Modal, Badge, Alert } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

export default function SupplierDebts() {
  const { hasPermission } = useAuth()
  const [stats, setStats] = useState(null)
  const [debts, setDebts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [supplier, setSupplier] = useState('')

  const [paying, setPaying] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'CASH', reference: '', notes: '' })
  const [payError, setPayError] = useState('')
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await api.get('/supplier-debts/summary')
      setStats(data.data)
    } catch { /* summary is optional */ }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      if (supplier) params.supplier = supplier
      const { data } = await api.get('/supplier-debts', { params })
      setDebts(data.data.debts)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, supplier])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSummary() }, [loadSummary])

  const loadSuppliers = useCallback(async () => {
    try {
      const { data } = await api.get('/suppliers', { params: { page: 1, limit: 100 } })
      setSuppliers(data.data.suppliers)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadSuppliers() }, [loadSuppliers])

  const openPay = (d) => {
    setPaying(d)
    setPayError('')
    setPayForm({ amount: d.remainingAmount, paymentMethod: 'CASH', reference: '', notes: '' })
  }

  const submitPayment = async (e) => {
    e.preventDefault()
    const amount = Number(payForm.amount)
    if (!amount || amount <= 0) {
      setPayError('Payment amount must be greater than 0.')
      return
    }
    if (amount > paying.remainingAmount) {
      setPayError(`Amount cannot exceed remaining balance of ${formatMoney(paying.remainingAmount)}.`)
      return
    }
    setSaving(true)
    setPayError('')
    try {
      await api.post('/supplier-payments', {
        purchaseId: paying._id,
        amount,
        paymentMethod: payForm.paymentMethod,
        reference: payForm.reference,
        notes: payForm.notes
      })
      setPaying(null)
      loadSummary()
      load()
    } catch (err) {
      setPayError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (d) => {
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/supplier-debts/${d._id}`)
      setDetail(data.data)
    } catch (err) {
      setDetailError(getError(err))
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-cash-coin me-2" />Supplier Debts / Payables <span className="text-muted fs-6">({total})</span>
      </h4>

      {stats && (
        <Row className="g-3 mb-4">
          <Col xl={3} md={6}><StatCard icon="bi-receipt" label="Total Debt" value={formatMoney(stats.totalDebt)} color="primary" sub={`${stats.outstandingCount} open purchase(s)`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-arrow-up-right-circle" label="Total Paid" value={formatMoney(stats.totalPaid)} color="success" sub="Payments received so far" /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-clock-history" label="Remaining Debt" value={formatMoney(stats.totalRemaining)} color="warning" sub={stats.overdueCount > 0 ? `${stats.overdueCount} overdue` : 'All up to date'} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-exclamation-triangle" label="Overdue Debt" value={String(stats.overdueCount)} color="danger" sub={`${formatMoney(stats.totalAllPaid)} of all purchases paid`} /></Col>
        </Row>
      )}

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control size="sm" placeholder="Search purchase # or supplier..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 280 }} />
          <Form.Select size="sm" value={supplier} onChange={(e) => { setSupplier(e.target.value); setPage(1) }} style={{ maxWidth: 220 }}>
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Form.Select>
        </div>

        <DataTable
          columns={[
            { key: 'purchaseNumber', label: 'Purchase #', render: (d) => <strong className="small">{d.purchaseNumber}</strong> },
            { key: 'supplierName', label: 'Supplier', render: (d) => (
              <span className="small">{d.supplierName || d.supplier?.name}<br /><small className="text-muted">{d.supplier?.phone}</small></span>
            )},
            { key: 'items', label: 'Products', render: (d) => (
              <span className="small text-muted">{d.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ').slice(0, 60)}{d.items.length ? '...' : ''}</span>
            )},
            { key: 'totalAmount', label: 'Total Amount', render: (d) => formatMoney(d.totalAmount) },
            { key: 'amountPaid', label: 'Amount Paid', render: (d) => <span className="text-success fw-semibold">{formatMoney(d.amountPaid)}</span> },
            { key: 'remainingAmount', label: 'Remaining', render: (d) => (
              <strong className={d.remainingAmount > 0 ? 'text-danger' : 'text-success'}>{formatMoney(d.remainingAmount)}</strong>
            )},
            { key: 'dueDate', label: 'Due Date', render: (d) => {
              if (!d.dueDate) return '-'
              const overdue = new Date(d.dueDate) < new Date() && d.paymentStatus !== 'PAID'
              return (
                <span className="small">
                  {new Date(d.dueDate).toLocaleDateString()}
                  {overdue && <><br /><Badge bg="" className="badge-soft-danger mt-1">OVERDUE</Badge></>}
                </span>
              )
            }},
            { key: 'paymentStatus', label: 'Status', render: (d) => <StatusBadge value={d.paymentStatus} /> },
            { key: 'actions', label: 'Actions', render: (d) => (
              <div className="d-flex gap-1">
                {hasPermission('supplierDebts.pay') && (
                  <Button size="sm" onClick={() => openPay(d)}><i className="bi bi-cash-coin me-1" />Pay</Button>
                )}
                <Button size="sm" variant="light" className="border" title="Payment history" onClick={() => openDetail(d)}><i className="bi bi-eye" /></Button>
              </div>
            )}
          ]}
          data={debts}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search purchase # or supplier..."
        />
      </Card>

      {/* Record Payment */}
      <Modal show={Boolean(paying)} onHide={() => setPaying(null)} centered backdrop="static">
        <Form onSubmit={submitPayment}>
          <Modal.Header closeButton>
            <Modal.Title className="fs-6 fw-bold"><i className="bi bi-cash-coin me-2" />Record Payment — {paying?.purchaseNumber}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {payError && <Alert variant="danger" className="py-2 small">{payError}</Alert>}
            {paying && (
              <div className="small mb-3">
                <div className="d-flex justify-content-between border-bottom pb-1 mb-1"><span className="text-muted">Supplier</span><strong>{paying.supplierName || paying.supplier?.name}</strong></div>
                <div className="d-flex justify-content-between border-bottom pb-1 mb-1"><span className="text-muted">Total Amount</span><strong>{formatMoney(paying.totalAmount)}</strong></div>
                <div className="d-flex justify-content-between border-bottom pb-1 mb-1"><span className="text-muted">Amount Paid</span><strong className="text-success">{formatMoney(paying.amountPaid)}</strong></div>
                <div className="d-flex justify-content-between"><span className="text-muted">Remaining</span><strong className="text-danger">{formatMoney(paying.remainingAmount)}</strong></div>
              </div>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Payment Amount *</Form.Label>
              <Form.Control
                type="number" min="0.01" step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                max={paying?.remainingAmount} required
              />
              <Form.Text className="text-muted">Max {paying ? formatMoney(paying.remainingAmount) : ''}</Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Payment Method *</Form.Label>
              <Form.Select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="MOMO">MoMo</option>
                <option value="BANK">Bank</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Reference</Form.Label>
              <Form.Control value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setPaying(null)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="success" disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1" />Recording...</> : <><i className="bi bi-check-lg me-1" />Record Payment</>}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* View Detail */}
      <Modal show={Boolean(detail)} onHide={() => setDetail(null)} size="lg" centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold"><i className="bi bi-receipt me-2" />{detail?.purchase?.purchaseNumber} — Payment History</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailError && <Alert variant="danger" className="py-2 small">{detailError}</Alert>}
          {detailLoading ? (
            <div className="text-center py-4 text-muted"><span className="spinner-border spinner-border-sm me-2" />Loading...</div>
          ) : detail && (
            <>
              <div className="d-flex flex-wrap gap-4 small mb-3">
                <span><span className="text-muted">Supplier:</span> <strong>{detail.purchase.supplierName || detail.purchase.supplier?.name}</strong></span>
                <span><span className="text-muted">Total:</span> <strong>{formatMoney(detail.purchase.totalAmount)}</strong></span>
                <span><span className="text-muted">Paid:</span> <strong className="text-success">{formatMoney(detail.purchase.amountPaid)}</strong></span>
                <span><span className="text-muted">Remaining:</span> <strong className="text-danger">{formatMoney(detail.purchase.remainingAmount)}</strong></span>
                <StatusBadge value={detail.purchase.paymentStatus} />
              </div>

              <strong className="small d-block mb-1">Items</strong>
              <div className="table-responsive mb-3">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead><tr><th>#</th><th>Product</th><th>SKU</th><th className="text-center">Qty</th><th className="text-end">Unit Cost</th><th className="text-end">Subtotal</th></tr></thead>
                  <tbody>
                    {detail.purchase.items.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">No items</td></tr>}
                    {detail.purchase.items.map((item, i) => (
                      <tr key={i}>
                        <td className="small">{i + 1}</td>
                        <td className="small">{item.productName}</td>
                        <td><code className="small">{item.product?.sku}</code></td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-end small">{formatMoney(item.costPrice)}</td>
                        <td className="text-end small fw-semibold">{formatMoney(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <strong className="small d-block mb-1">Payment History ({detail.payments.length})</strong>
              <div className="table-responsive" style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead><tr><th>#</th><th>Amount</th><th>Method</th><th>Ref</th><th>Notes</th><th>By</th><th>Date</th></tr></thead>
                  <tbody>
                    {detail.payments.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-3">No payments recorded</td></tr>}
                    {detail.payments.map((p) => (
                      <tr key={p._id}>
                        <td><code className="small">{p.paymentNumber}</code></td>
                        <td className="fw-semibold text-success">{formatMoney(p.amount)}</td>
                        <td><StatusBadge value={p.paymentMethod} /></td>
                        <td className="small">{p.reference ? <code style={{ fontSize: '0.7rem' }}>{p.reference}</code> : '-'}</td>
                        <td className="small text-muted">{p.notes || '-'}</td>
                        <td className="small">{p.createdBy?.fullName}</td>
                        <td className="small">{new Date(p.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {hasPermission('supplierDebts.pay') && detail?.purchase?.paymentStatus !== 'PAID' && (
            <Button variant="success" onClick={() => { setDetail(null); openPay(detail.purchase) }}>
              <i className="bi bi-cash-coin me-1" />Record Payment
            </Button>
          )}
          <Button variant="light" onClick={() => setDetail(null)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}