import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Modal, Form, Row, Col, Alert, Badge } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import PasswordInput from '../../components/common/PasswordInput'

const empty = { fullName: '', username: '', email: '', phone: '', password: '', role: '' }

export default function Users() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
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
  const [deleting, setDeleting] = useState(null)
  const [resetting, setResetting] = useState(null)
  const [tempPassword, setTempPassword] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      const { data } = await api.get('/users', { params })
      setUsers(data.data.users)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/roles').then((r) => setRoles(r.data.data.roles)).catch(() => {})
  }, [])

  const openForm = (user) => {
    setError('')
    setEditing(user || null)
    setForm(user
      ? { fullName: user.fullName, username: user.username, email: user.email, phone: user.phone || '', password: '', role: user.role?._id }
      : empty)
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        const payload = { fullName: form.fullName, email: form.email, phone: form.phone, role: form.role }
        await api.put(`/users/${editing._id}`, payload)
      } else {
        await api.post('/users', form)
      }
      setShowForm(false)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (user) => {
    try {
      await api.put(`/users/${user._id}`, { isActive: !user.isActive })
      load()
    } catch (err) {
      alert(getError(err))
    }
  }

  const remove = async () => {
    try {
      await api.delete(`/users/${deleting._id}`)
      setDeleting(null)
      load()
    } catch (err) {
      alert(getError(err))
      setDeleting(null)
    }
  }

  const resetPassword = async () => {
    try {
      const { data } = await api.put(`/users/${resetting._id}/reset-password`)
      setTempPassword(data.data.temporaryPassword)
      setResetting(null)
    } catch (err) {
      alert(getError(err))
      setResetting(null)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-person-gear me-2" />Users <span className="text-muted fs-6">({total})</span>
        </h4>
        <Button onClick={() => openForm(null)}><i className="bi bi-person-plus me-1" />Add User</Button>
      </div>

      <Card body>
        <DataTable
          columns={[
            { key: 'fullName', label: 'Name', render: (u) => (
              <span><strong>{u.fullName}</strong><br /><small className="text-muted">@{u.username}</small></span>
            )},
            { key: 'email', label: 'Email', render: (u) => <span className="small">{u.email}</span> },
            { key: 'phone', label: 'Phone', render: (u) => u.phone || '-' },
            { key: 'role', label: 'Role', render: (u) => <Badge bg="" className={u.role?.name === 'Super Admin' ? 'badge-soft-danger' : 'badge-soft-primary'}>{u.role?.name}</Badge> },
            { key: 'addedBy', label: 'Added By', render: (u) => <span className="small text-muted">{u.addedBy ? u.addedBy.fullName : 'System / Seed'}</span> },
            { key: 'isActive', label: 'Status', render: (u) => <StatusBadge value={u.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            { key: 'lastLoginAt', label: 'Last Login', render: (u) => <span className="small text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}</span> },
            { key: 'actions', label: 'Actions', render: (u) => (
              <div className="d-flex gap-1">
                <Button size="sm" variant="light" className="border" onClick={() => openForm(u)} title="Edit"><i className="bi bi-pencil" /></Button>
                <Button size="sm" variant="light" className="border" onClick={() => setResetting(u)} title="Reset password"><i className="bi bi-key" /></Button>
                <Button size="sm" variant="light" className={`border ${u.isActive ? '' : 'text-success'}`} onClick={() => toggleActive(u)} title={u.isActive ? 'Deactivate' : 'Activate'}>
                  <i className={`bi ${u.isActive ? 'bi-person-slash' : 'bi-person-check'}`} />
                </Button>
                <Button size="sm" variant="light" className="border text-danger" onClick={() => setDeleting(u)} title="Delete"><i className="bi bi-trash" /></Button>
              </div>
            )}
          ]}
          data={users}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search users..."
        />
      </Card>

      {/* Add/Edit */}
      <Modal show={showForm} onHide={() => setShowForm(false)} centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">{editing ? `Edit User — ${editing.fullName}` : 'Add User'}</Modal.Title></Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-3">
              <Col md={12}><Form.Group><Form.Label>Full Name *</Form.Label><Form.Control value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></Form.Group></Col>
              {!editing && (
                <>
                  <Col md={6}><Form.Group><Form.Label>Username *</Form.Label><Form.Control value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></Form.Group></Col>
                  <Col md={6}><Form.Group><Form.Label>Password *</Form.Label><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={6} required /></Form.Group></Col>
                </>
              )}
              <Col md={6}><Form.Group><Form.Label>Email *</Form.Label><Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Form.Group></Col>
              <Col md={6}><Form.Group><Form.Label>Phone</Form.Label><Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Form.Group></Col>
              <Col md={12}>
                <Form.Group><Form.Label>Role *</Form.Label>
                  <Form.Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
                    <option value="">-- Select role --</option>
                    {roles.map((r) => <option key={r._id} value={r._id}>{r.name} ({r.permissions?.length || 0} permissions)</option>)}
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

      <ConfirmDialog show={Boolean(deleting)} title="Delete User"
        message={`Delete "${deleting?.fullName}"? This cannot be undone.`}
        onClose={() => setDeleting(null)} onConfirm={remove} />

      <ConfirmDialog show={Boolean(resetting)} title="Reset Password"
        message={`Generate a temporary password for "${resetting?.fullName}"? They should change it after logging in.`}
        confirmLabel="Reset Password" onClose={() => setResetting(null)} onConfirm={resetPassword} />

      <Modal show={Boolean(tempPassword)} onHide={() => setTempPassword('')} centered>
        <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">Temporary Password</Modal.Title></Modal.Header>
        <Modal.Body>
          <p className="small text-muted">Share this securely. The user must change it after logging in.</p>
          <Alert variant="warning" className="text-center fs-5 fw-bold font-monospace">{tempPassword}</Alert>
        </Modal.Body>
      </Modal>
    </div>
  )
}
