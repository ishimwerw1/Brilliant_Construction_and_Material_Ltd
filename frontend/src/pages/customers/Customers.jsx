import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Modal, Form, Row, Col, Alert } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const empty = { name: '', phone: '', email: '', address: '' }

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [withDebt, setWithDebt] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const { hasPermission } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      if (withDebt) params.withDebt = 'true'
      const { data } = await api.get('/customers', { params })
      setCustomers(data.data.customers)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, withDebt])

  useEffect(() => { load() }, [load])

  const openForm = (customer) => {
    setError('')
    setEditing(customer || null)
    setForm(customer ? { name: customer.name, phone: customer.phone, email: customer.email || '', address: customer.address || '' } : empty)
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await api.put(`/customers/${editing._id}`, form)
      else await api.post('/customers', form)
      setShowForm(false)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/customers/${deleting._id}`)
      setDeleting(null)
      load()
    } catch (err) {
      alert(getError(err))
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-people me-2" />Customers <span className="text-muted fs-6">({total})</span>
        </h4>
        {hasPermission('customers.create') && <Button onClick={() => openForm(null)}><i className="bi bi-person-plus me-1" />Add Customer</Button>}
      </div>

      <Card body>
        <DataTable
          columns={[
            { key: 'name', label: 'Customer', render: (c) => (
              <Link to={`/customers/${c._id}`} className="text-decoration-none fw-semibold" style={{ color: '#0d3b66' }}>{c.name}</Link>
            )},
            { key: 'phone', label: 'Phone', render: (c) => <code className="small">{c.phone}</code> },
            { key: 'email', label: 'Email', render: (c) => <span className="small text-muted">{c.email || '-'}</span> },
            { key: 'totalPurchases', label: 'Purchases', render: (c) => formatMoney(c.totalPurchases) },
            { key: 'totalPaid', label: 'Paid', render: (c) => formatMoney(c.totalPaid) },
            { key: 'outstandingBalance', label: 'Balance', render: (c) => (
              <strong className={c.outstandingBalance > 0 ? 'text-danger' : 'text-success'}>{formatMoney(c.outstandingBalance)}</strong>
            )},
            { key: 'status', label: 'Status', render: (c) => <StatusBadge value={c.status} /> },
            { key: 'actions', label: 'Actions', render: (c) => (
              <div className="d-flex gap-1">
                <Link to={`/customers/${c._id}`} className="btn btn-sm btn-light border"><i className="bi bi-eye" /></Link>
                {hasPermission('customers.update') && (
                  <Button size="sm" variant="light" className="border" onClick={() => openForm(c)}><i className="bi bi-pencil" /></Button>
                )}
                {hasPermission('customers.delete') && (
                  <Button size="sm" variant="light" className="border text-danger" onClick={() => setDeleting(c)}><i className="bi bi-trash" /></Button>
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
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search by name or phone..."
          toolbar={
            <Form.Check
              type="switch"
              id="withDebt"
              label="Only with debt"
              checked={withDebt}
              onChange={(e) => { setWithDebt(e.target.checked); setPage(1) }}
              className="align-self-center"
            />
          }
        />
      </Card>

      <Modal show={showForm} onHide={() => setShowForm(false)} centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">{editing ? 'Edit Customer' : 'Add Customer'}</Modal.Title></Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-3">
              <Col md={12}>
                <Form.Group><Form.Label>Name *</Form.Label>
                  <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group><Form.Label>Phone *</Form.Label>
                  <Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required placeholder="0788..." />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group><Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group><Form.Label>Address</Form.Label>
                  <Form.Control value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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

      <ConfirmDialog
        show={Boolean(deleting)}
        title="Delete Customer"
        message={`Delete "${deleting?.name}"? Only possible when the customer has no purchase records.`}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  )
}
