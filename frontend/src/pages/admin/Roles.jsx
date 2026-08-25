import { useEffect, useState } from 'react'
import { Card, Row, Col, Button, Modal, Form, Badge, Alert } from 'react-bootstrap'
import api, { getError } from '../../api/client'

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [allPermissions, setAllPermissions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', permissions: [] })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/roles').then((r) => {
      setRoles(r.data.data.roles)
      setAllPermissions(r.data.data.allPermissions)
    })
  }
  useEffect(load, [])

  const openForm = (role) => {
    setError('')
    setEditing(role || null)
    setForm(role
      ? { name: role.name, description: role.description || '', permissions: [...role.permissions] }
      : { name: '', description: '', permissions: [] })
    setShowForm(true)
  }

  const togglePermission = (p) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter((x) => x !== p) : [...f.permissions, p]
    }))
  }

  const grouped = allPermissions.reduce((acc, p) => {
    const group = p.split('.')[0]
    acc[group] = acc[group] || []
    acc[group].push(p)
    return acc
  }, {})

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await api.put(`/roles/${editing._id}`, form)
      else await api.post('/roles', form)
      setShowForm(false)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-shield-lock me-2" />Roles & Permissions
        </h4>
        <Button onClick={() => openForm(null)}><i className="bi bi-plus-lg me-1" />Add Role</Button>
      </div>

      <Row className="g-3">
        {roles.map((role) => (
          <Col key={role._id} md={6} xl={4}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <span className={`badge ${role.name === 'Super Admin' ? 'badge-soft-danger' : 'badge-soft-primary'} fs-6`}>{role.name}</span>
                    <div className="text-muted small mt-1">{role.userCount} user(s)</div>
                  </div>
                  {role.name !== 'Super Admin' && (
                    <Button size="sm" variant="light" className="border" onClick={() => openForm(role)}><i className="bi bi-pencil" /></Button>
                  )}
                </div>
                <p className="small text-muted">{role.description}</p>
                <hr className="my-2" />
                <div className="d-flex flex-wrap gap-1">
                  {(role.name === 'Super Admin'
                    ? ['ALL PERMISSIONS']
                    : role.permissions.slice(0, 8).map((p) => p)
                  ).map((p) => (
                    <Badge key={p} bg="" className="badge-soft-secondary" style={{ fontSize: '0.65rem' }}>{p === 'ALL PERMISSIONS' ? p : p.split('.')[1]?.toUpperCase() || p}</Badge>
                  ))}
                  {role.name !== 'Super Admin' && role.permissions.length > 8 && (
                    <Badge bg="" className="badge-soft-info">+{role.permissions.length - 8} more</Badge>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal show={showForm} onHide={() => setShowForm(false)} size="lg" centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">{editing ? `Edit Role — ${editing.name}` : 'Add Role'}</Modal.Title></Modal.Header>
          <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-2 mb-3">
              <Col md={5}><Form.Group><Form.Label>Role Name *</Form.Label><Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Form.Group></Col>
              <Col md={7}><Form.Group><Form.Label>Description</Form.Label><Form.Control value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Form.Group></Col>
            </Row>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong className="small">Permissions ({form.permissions.length})</strong>
              <div className="d-flex gap-2">
                <Button size="sm" variant="link" className="p-0 text-decoration-none" onClick={() => setForm({ ...form, permissions: [...allPermissions] })}>Select all</Button>
                <Button size="sm" variant="link" className="p-0 text-danger text-decoration-none" onClick={() => setForm({ ...form, permissions: [] })}>Clear</Button>
              </div>
            </div>

            {Object.entries(grouped).map(([group, perms]) => (
              <div key={group} className="border rounded p-2 mb-2">
                <div className="fw-semibold small text-uppercase text-muted mb-1">{group}</div>
                <div className="row row-cols-1 row-cols-md-3 g-1">
                  {perms.map((p) => (
                    <Form.Check key={p} type="checkbox" id={`perm-${p}`} className="col small"
                      label={p.split('.')[1]}
                      checked={form.permissions.includes(p)}
                      onChange={() => togglePermission(p)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Role'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}
