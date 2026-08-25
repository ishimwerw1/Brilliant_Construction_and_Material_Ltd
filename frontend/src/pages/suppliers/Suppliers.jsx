import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Modal, Form, Row, Col, Alert } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const empty = { name: '', companyName: '', phone: '', email: '', address: '', notes: '', status: 'ACTIVE' }

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { hasPermission } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      const { data } = await api.get('/suppliers', { params })
      setSuppliers(data.data.suppliers)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const openForm = (s) => {
    setError('')
    setEditing(s || null)
    setForm(s ? { name: s.name, companyName: s.companyName || '', phone: s.phone, email: s.email || '', address: s.address || '', notes: s.notes || '', status: s.status || 'ACTIVE' } : empty)
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await api.put(`/suppliers/${editing._id}`, form)
      else await api.post('/suppliers', form)
      setShowForm(false)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (s) => {
    setError('')
    try {
      await api.put(`/suppliers/${s._id}`, { status: s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
      load()
    } catch (err) {
      setError(getError(err))
    }
  }

  const openDetail = async (s) => {
    const { data } = await api.get(`/suppliers/${s._id}`)
    setDetail(data.data)
  }

  const doDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/suppliers/${confirmDel._id}`)
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
          <i className="bi bi-truck me-2" />Suppliers <span className="text-muted fs-6">({total})</span>
        </h4>
        {hasPermission('suppliers.create') && <Button onClick={() => openForm(null)}><i className="bi bi-plus-lg me-1" />Add Supplier</Button>}
      </div>

      <Card body>
        {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small mb-3">{error}</Alert>}
        <DataTable
          columns={[
            { key: 'name', label: 'Supplier', render: (s) => (
              <button className="btn btn-link text-decoration-none p-0 fw-semibold" style={{ color: '#0d3b66' }} onClick={() => openDetail(s)}>
                {s.name}
              </button>
            )},
            { key: 'companyName', label: 'Company', render: (s) => s.companyName || '-' },
            { key: 'phone', label: 'Phone', render: (s) => <code className="small">{s.phone}</code> },
            { key: 'email', label: 'Email', render: (s) => <span className="small text-muted">{s.email || '-'}</span> },
            { key: 'productCount', label: 'Products', render: (s) => s.productCount },
            { key: 'stockValue', label: 'Stock Value', render: (s) => formatMoney(s.stockValue) },
            { key: 'status', label: 'Status', render: (s) => <StatusBadge value={s.status} /> },
            { key: 'actions', label: 'Actions', render: (s) => (
              <div className="d-flex gap-1">
                <Button size="sm" variant="light" className="border" onClick={() => openDetail(s)}><i className="bi bi-eye" /></Button>
                {hasPermission('suppliers.update') && (
                  <>
                    <Button size="sm" variant="light" className="border" onClick={() => openForm(s)}><i className="bi bi-pencil" /></Button>
                    <Button
                      size="sm"
                      variant={s.status === 'ACTIVE' ? 'outline-warning' : 'outline-success'}
                      title={s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      onClick={() => toggleStatus(s)}
                    >
                      <i className={`bi ${s.status === 'ACTIVE' ? 'bi-pause-circle' : 'bi-play-circle'}`} />
                    </Button>
                  </>
                )}
                {hasPermission('suppliers.delete') && (
                  <Button size="sm" variant="outline-danger" title="Delete supplier" onClick={() => setConfirmDel(s)}><i className="bi bi-trash" /></Button>
                )}
              </div>
            )}
          ]}
          data={suppliers}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search suppliers..."
        />
      </Card>

      {/* Add/Edit */}
      <Modal show={showForm} onHide={() => setShowForm(false)} centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">{editing ? 'Edit Supplier' : 'Add Supplier'}</Modal.Title></Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-3">
              <Col md={6}><Form.Group><Form.Label>Name *</Form.Label><Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Form.Group></Col>
              <Col md={6}><Form.Group><Form.Label>Company Name</Form.Label><Form.Control value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Form.Group></Col>
              <Col md={6}><Form.Group><Form.Label>Phone *</Form.Label><Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></Form.Group></Col>
              <Col md={6}><Form.Group><Form.Label>Email</Form.Label><Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Form.Group></Col>
              <Col md={12}><Form.Group><Form.Label>Address</Form.Label><Form.Control value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Form.Group></Col>
              <Col md={12}><Form.Group><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Form.Group></Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Detail with purchase history */}
      <Modal show={Boolean(detail)} onHide={() => setDetail(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold"><i className="bi bi-truck me-2" />{detail?.supplier?.name} — Purchase History</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detail && (
            <>
              <div className="d-flex flex-wrap gap-4 small mb-3">
                <span><i className="bi bi-telephone me-1 text-muted" /><code>{detail.supplier.phone}</code></span>
                {detail.supplier.email && <span><i className="bi bi-envelope me-1 text-muted" />{detail.supplier.email}</span>}
                {detail.supplier.address && <span><i className="bi bi-geo-alt me-1 text-muted" />{detail.supplier.address}</span>}
                <StatusBadge value={detail.supplier.status} />
              </div>

              <strong className="small d-block mb-1">Products supplied ({detail.products.length})</strong>
              <div className="mb-3 d-flex flex-wrap gap-1">
                {detail.products.length === 0 && <span className="text-muted small">None yet</span>}
                {detail.products.map((p) => (
                  <span key={p._id} className="badge badge-soft-primary">{p.name}</span>
                ))}
              </div>

              <strong className="small d-block mb-1">Recent stock receipts</strong>
              <div className="table-responsive" style={{ maxHeight: 260, overflowY: 'auto' }}>
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead><tr><th>Date</th><th>Product</th><th>Qty In</th><th>Unit Price</th><th>Ref</th><th>By</th></tr></thead>
                  <tbody>
                    {detail.purchases.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-3">No purchases recorded</td></tr>}
                    {detail.purchases.map((p) => (
                      <tr key={p._id}>
                        <td className="small">{new Date(p.createdAt).toLocaleDateString()}</td>
                        <td className="small">{p.productName}</td>
                        <td className="fw-semibold text-success">+{p.quantity}</td>
                        <td className="small">{formatMoney(p.unitPrice)}</td>
                        <td><code style={{ fontSize: '0.7rem' }}>{p.reference}</code></td>
                        <td className="small">{p.performedBy?.fullName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      <ConfirmDialog
        show={Boolean(confirmDel)}
        onClose={() => setConfirmDel(null)}
        title="Delete Supplier"
        message={confirmDel?.productCount > 0
          ? `"${confirmDel?.name}" has ${confirmDel.productCount} product(s) linked and cannot be deleted. Deactivate it instead.`
          : `Delete supplier "${confirmDel?.name}" permanently? This cannot be undone. Suppliers with linked products cannot be deleted.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  )
}
