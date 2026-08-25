import { useCallback, useEffect, useState } from 'react'
import { Card, Button, Modal, Form, Row, Col, Badge } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import ConfirmDialog from '../../components/common/ConfirmDialog'

export default function Categories() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', parent: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const { hasPermission } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/categories')
      setCategories(data.data.categories)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openForm = (cat) => {
    setError('')
    setEditing(cat || null)
    setForm(cat ? { name: cat.name, description: cat.description || '', parent: cat.parent?._id || '' } : { name: '', description: '', parent: '' })
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await api.put(`/categories/${editing._id}`, form)
      else await api.post('/categories', form)
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
      await api.delete(`/categories/${deleting._id}`)
      setDeleting(null)
      load()
    } catch (err) {
      alert(getError(err))
      setDeleting(null)
    }
  }

  const roots = categories.filter((c) => !c.parent)
  const childrenOf = (id) => categories.filter((c) => c.parent?._id === id)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-diagram-3 me-2" />Categories
        </h4>
        {hasPermission('categories.create') && <Button onClick={() => openForm(null)}><i className="bi bi-plus-lg me-1" />Add Category</Button>}
      </div>

      <Row className="g-3">
        {roots.map((root) => (
          <Col key={root._id} md={6} xl={4}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start">
                  <div className="d-flex align-items-center gap-2">
                    <span className="d-inline-flex align-items-center justify-content-center rounded" style={{ width: 38, height: 38, background: '#e8edf5', color: '#0d3b66' }}>
                      <i className="bi bi-folder-fill" />
                    </span>
                    <div>
                      <div className="fw-semibold">{root.name}</div>
                      <small className="text-muted">{root.productCount} product(s)</small>
                    </div>
                  </div>
                  {hasPermission('categories.update') && (
                    <Button size="sm" variant="light" className="border" onClick={() => openForm(root)}><i className="bi bi-pencil" /></Button>
                  )}
                </div>

                {(childrenOf(root._id).length > 0 || hasPermission('categories.create')) && (
                  <div className="mt-3 border-top pt-2">
                    {childrenOf(root._id).map((child) => (
                      <div key={child._id} className="d-flex justify-content-between align-items-center py-1 ps-3">
                        <span className="small"><i className="bi bi-arrow-return-right text-muted me-1" />{child.name} <Badge bg="" className="badge-soft-secondary ms-1">{child.productCount}</Badge></span>
                        <div className="d-flex gap-1">
                          {hasPermission('categories.update') && (
                            <button className="btn btn-sm btn-link p-0 text-muted" onClick={() => openForm(child)}><i className="bi bi-pencil small" /></button>
                          )}
                          {hasPermission('categories.delete') && (
                            <button className="btn btn-sm btn-link p-0 text-danger" onClick={() => setDeleting(child)}><i className="bi bi-trash small" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal show={showForm} onHide={() => setShowForm(false)} centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton><Modal.Title className="fs-6 fw-bold">{editing ? 'Edit Category' : 'Add Category'}</Modal.Title></Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Name *</Form.Label>
              <Form.Control value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Pipes" />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Parent Category</Form.Label>
              <Form.Select value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })}>
                <option value="">None (top level)</option>
                {roots.filter((r) => r._id !== editing?._id).map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={Boolean(deleting)}
        title="Delete Category"
        message={`Delete category "${deleting?.name}"? This is only possible when it has no products or subcategories.`}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  )
}
