import { useCallback, useEffect, useState } from 'react'
import { Card, Row, Col, Button, Modal, Form, Badge, Alert, Table } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const emptyItem = { product: '', productName: '', quantity: 1, costPrice: 0 }

const emptyForm = {
  supplier: '',
  items: [{ ...emptyItem }],
  paymentMethod: 'CASH',
  amountPaid: '',
  dueDate: '',
  notes: ''
}

export default function Purchases() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('ALL')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editNotes, setEditNotes] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const { hasPermission } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      if (paymentStatus !== 'ALL') params.paymentStatus = paymentStatus
      if (supplierFilter) params.supplier = supplierFilter
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/purchases', { params })
      setPurchases(data.data.purchases)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, paymentStatus, supplierFilter, from, to])

  const loadLookups = useCallback(async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        api.get('/suppliers', { params: { limit: 200, status: 'ACTIVE' } }),
        api.get('/products', { params: { limit: 200, status: 'ACTIVE' } })
      ])
      setSuppliers(supRes.data.data.suppliers)
      setProducts(prodRes.data.data.products)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadLookups() }, [loadLookups])

  const selectedSupplier = suppliers.find((s) => s._id === form.supplier)

  const computedTotal = form.items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0)
  const amountPaidNum = Number(form.amountPaid || 0)
  const remaining = Math.max(0, computedTotal - amountPaidNum)
  const computedStatus = computedTotal === 0 ? 'UNPAID' : amountPaidNum >= computedTotal ? 'PAID' : amountPaidNum > 0 ? 'PARTIALLY_PAID' : 'UNPAID'

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] })

  const removeItem = (idx) => {
    const items = form.items.filter((_, i) => i !== idx)
    setForm({ ...form, items: items.length ? items : [{ ...emptyItem }] })
  }

  const updateItem = (idx, field, value) => {
    setForm({
      ...form,
      items: form.items.map((item, i) => {
        if (i !== idx) return item
        const updated = { ...item, [field]: value }
        if (field === 'product') {
          const prod = products.find((p) => p._id === value)
          updated.productName = prod?.name || ''
          updated.costPrice = prod?.buyingPrice || 0
        }
        if (field === 'quantity') {
          updated.quantity = Math.max(1, Number(value) || 1)
        }
        if (field === 'costPrice') {
          updated.costPrice = Math.max(0, Number(value) || 0)
        }
        return updated
      })
    })
  }

  const openForm = () => {
    setError('')
    setForm({ ...emptyForm, items: [{ ...emptyItem }] })
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.supplier) { setError('Please select a supplier.'); return }
    const validItems = form.items.filter((i) => i.product && i.quantity > 0)
    if (validItems.length === 0) { setError('Please add at least one item.'); return }

    setSaving(true)
    setError('')
    try {
      const payload = {
        supplier: form.supplier,
        items: validItems.map((i) => ({ product: i.product, productName: i.productName, quantity: i.quantity, costPrice: i.costPrice })),
        paymentMethod: form.paymentMethod,
        amountPaid: Number(form.amountPaid || 0),
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined
      }
      await api.post('/purchases', payload)
      setShowForm(false)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (p) => {
    setEditing(p)
    setEditNotes(p.notes || '')
    setEditDueDate(p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : '')
  }

  const submitEdit = async () => {
    setEditSaving(true)
    setError('')
    try {
      await api.put(`/purchases/${editing._id}`, { notes: editNotes, dueDate: editDueDate || undefined })
      setEditing(null)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setEditSaving(false)
    }
  }

  const doDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/purchases/${confirmDel._id}`)
      setConfirmDel(null)
      load()
    } catch (err) {
      setError(getError(err))
      setConfirmDel(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-bag-check me-2" />Purchases <span className="text-muted fs-6">({total})</span>
        </h4>
        {hasPermission('purchases.create') && (
          <Button onClick={openForm}><i className="bi bi-plus-lg me-1" />Add Purchase</Button>
        )}
      </div>

      {error && !showForm && !editing && !confirmDel && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small mb-3">{error}</Alert>
      )}

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Select size="sm" value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1) }} style={{ maxWidth: 170 }}>
            <option value="ALL">All Statuses</option>
            <option value="PAID">PAID</option>
            <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
            <option value="UNPAID">UNPAID</option>
          </Form.Select>
          <Form.Select size="sm" value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1) }} style={{ maxWidth: 180 }}>
            <option value="">All Suppliers</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'purchaseNumber', label: 'Purchase #', render: (p) => (
              <button className="btn btn-link text-decoration-none p-0 fw-semibold small" style={{ color: '#0d3b66' }} onClick={() => setDetail(p)}>
                {p.purchaseNumber}
              </button>
            )},
            { key: 'createdAt', label: 'Date', render: (p) => <span className="small">{new Date(p.createdAt).toLocaleDateString()}</span> },
            { key: 'supplier', label: 'Supplier', render: (p) => (
              <span className="small">{p.supplier?.name}<br /><small className="text-muted">{p.supplier?.phone}</small></span>
            )},
            { key: 'items', label: 'Items', render: (p) => <Badge bg="" className="badge-soft-info">{p.items?.length || 0}</Badge> },
            { key: 'totalAmount', label: 'Total', render: (p) => <strong>{formatMoney(p.totalAmount)}</strong> },
            { key: 'amountPaid', label: 'Paid', render: (p) => <span className="text-success small">{formatMoney(p.amountPaid)}</span> },
            { key: 'remainingAmount', label: 'Remaining', render: (p) => (
              <span className={p.remainingAmount > 0 ? 'text-danger fw-semibold small' : 'text-muted small'}>{formatMoney(p.remainingAmount)}</span>
            )},
            { key: 'paymentStatus', label: 'Status', render: (p) => <StatusBadge value={p.paymentStatus} /> },
            { key: 'createdBy', label: 'Created By', render: (p) => <span className="small">{p.createdBy?.fullName || '-'}</span> },
            { key: 'actions', label: 'Actions', render: (p) => (
              <div className="d-flex gap-1">
                <Button size="sm" variant="light" className="border" onClick={() => setDetail(p)}><i className="bi bi-eye" /></Button>
                {hasPermission('purchases.update') && (
                  <Button size="sm" variant="light" className="border" onClick={() => openEdit(p)}><i className="bi bi-pencil" /></Button>
                )}
                {hasPermission('purchases.delete') && (
                  <Button size="sm" variant="outline-danger" onClick={() => setConfirmDel(p)}><i className="bi bi-trash" /></Button>
                )}
              </div>
            )}
          ]}
          data={purchases}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search purchases..."
        />
      </Card>

      {/* Detail Modal */}
      <Modal show={Boolean(detail)} onHide={() => setDetail(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">
            <i className="bi bi-bag-check me-2" />Purchase {detail?.purchaseNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detail && (
            <>
              <Row className="g-3 mb-3 small">
                <Col sm={6}>
                  <div className="text-muted">Supplier</div>
                  <div className="fw-semibold">{detail.supplier?.name}</div>
                  <div>{detail.supplier?.phone}</div>
                </Col>
                <Col sm={3}>
                  <div className="text-muted">Date</div>
                  <div>{new Date(detail.createdAt).toLocaleDateString()}</div>
                </Col>
                <Col sm={3}>
                  <div className="text-muted">Status</div>
                  <div><StatusBadge value={detail.paymentStatus} /></div>
                </Col>
              </Row>

              <div className="table-responsive">
                <Table size="sm" className="align-middle mb-2">
                  <thead>
                    <tr><th>Product</th><th className="text-end">Qty</th><th className="text-end">Cost Price</th><th className="text-end">Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {detail.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td className="small">{item.productName}</td>
                        <td className="text-end">{item.quantity}</td>
                        <td className="text-end">{formatMoney(item.costPrice)}</td>
                        <td className="text-end fw-semibold">{formatMoney(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-light">
                      <td colSpan={3} className="text-end fw-bold">Total</td>
                      <td className="text-end fw-bold">{formatMoney(detail.totalAmount)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="text-end text-muted">Paid</td>
                      <td className="text-end text-success">{formatMoney(detail.amountPaid)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="text-end text-muted">Remaining</td>
                      <td className="text-end text-danger fw-semibold">{formatMoney(detail.remainingAmount)}</td>
                    </tr>
                  </tfoot>
                </Table>
              </div>

              <Row className="g-3 small mt-1">
                <Col sm={4}>
                  <span className="text-muted">Method: </span>
                  <Badge bg="" className={`badge-soft-${detail.paymentMethod === 'CASH' ? 'success' : detail.paymentMethod === 'MOMO' ? 'info' : 'primary'}`}>{detail.paymentMethod}</Badge>
                </Col>
                {detail.dueDate && <Col sm={4}><span className="text-muted">Due: </span>{new Date(detail.dueDate).toLocaleDateString()}</Col>}
                <Col sm={4}><span className="text-muted">By: </span>{detail.createdBy?.fullName}</Col>
              </Row>
              {detail.notes && <div className="small text-muted mt-2"><i className="bi bi-sticky me-1" />{detail.notes}</div>}
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Add Purchase Modal */}
      <Modal show={showForm} onHide={() => setShowForm(false)} size="lg" centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton>
            <Modal.Title className="fs-6 fw-bold"><i className="bi bi-bag-plus me-2" />Add Purchase</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}

            <Row className="g-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Supplier *</Form.Label>
                  <Form.Select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} required>
                    <option value="">Select supplier...</option>
                    {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.phone})</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                {selectedSupplier && (
                  <div className="small mt-4">
                    <div className="text-muted">Contact</div>
                    <div className="fw-semibold">{selectedSupplier.phone}</div>
                    {selectedSupplier.email && <div className="text-muted">{selectedSupplier.email}</div>}
                  </div>
                )}
              </Col>
            </Row>

            <hr className="my-3" />
            <div className="d-flex justify-content-between align-items-center mb-2">
              <Form.Label className="fw-semibold mb-0">Items *</Form.Label>
              <Button size="sm" variant="outline-primary" type="button" onClick={addItem}>
                <i className="bi bi-plus-lg me-1" />Add Item
              </Button>
            </div>

            {form.items.map((item, idx) => (
              <Row key={idx} className="g-2 mb-2 align-items-end">
                <Col md={5}>
                  {idx === 0 && <Form.Label className="small text-muted">Product</Form.Label>}
                  <Form.Select size="sm" value={item.product} onChange={(e) => updateItem(idx, 'product', e.target.value)} required>
                    <option value="">Select product...</option>
                    {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
                  </Form.Select>
                </Col>
                <Col md={2}>
                  {idx === 0 && <Form.Label className="small text-muted">Qty</Form.Label>}
                  <Form.Control size="sm" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} required />
                </Col>
                <Col md={2}>
                  {idx === 0 && <Form.Label className="small text-muted">Cost Price</Form.Label>}
                  <Form.Control size="sm" type="number" min="0" value={item.costPrice} onChange={(e) => updateItem(idx, 'costPrice', e.target.value)} required />
                </Col>
                <Col md={2}>
                  {idx === 0 && <Form.Label className="small text-muted">Subtotal</Form.Label>}
                  <div className="small fw-semibold pt-1">{formatMoney(item.quantity * item.costPrice)}</div>
                </Col>
                <Col md={1}>
                  {idx === 0 && <Form.Label className="small text-muted">&nbsp;</Form.Label>}
                  {form.items.length > 1 && (
                    <Button size="sm" variant="outline-danger" type="button" className="py-0" onClick={() => removeItem(idx)}>
                      <i className="bi bi-x-lg" />
                    </Button>
                  )}
                </Col>
              </Row>
            ))}

            <div className="d-flex justify-content-end mt-2 mb-3">
              <strong className="fs-6" style={{ color: '#0d3b66' }}>Total: {formatMoney(computedTotal)}</strong>
            </div>

            <hr className="my-3" />

            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Payment Method *</Form.Label>
                  <Form.Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} required>
                    {['CASH', 'MOMO', 'BANK'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Amount Paid (RWF)</Form.Label>
                  <Form.Control type="number" min="0" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} placeholder="0" />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Payment Status</Form.Label>
                  <div className="pt-1"><StatusBadge value={computedStatus} /></div>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Due Date</Form.Label>
                  <Form.Control type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={8}>
                <Form.Group>
                  <Form.Label>Notes</Form.Label>
                  <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
                </Form.Group>
              </Col>
            </Row>

            {remaining > 0 && (
              <Alert variant="warning" className="py-2 small mb-0 mt-3">
                <i className="bi bi-exclamation-triangle me-1" />
                Remaining balance: <strong>{formatMoney(remaining)}</strong>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save Purchase'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Edit Purchase Modal (notes & dueDate only) */}
      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold"><i className="bi bi-pencil me-2" />Edit Purchase {editing?.purchaseNumber}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Notes</Form.Label>
            <Form.Control as="textarea" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Due Date</Form.Label>
            <Form.Control type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={submitEdit} disabled={editSaving}>
            {editSaving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmDialog
        show={Boolean(confirmDel)}
        onClose={() => setConfirmDel(null)}
        title="Delete Purchase"
        message={`Delete purchase "${confirmDel?.purchaseNumber}" permanently? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  )
}
