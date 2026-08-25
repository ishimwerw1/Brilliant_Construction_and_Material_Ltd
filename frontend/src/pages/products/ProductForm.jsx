import { useEffect, useState } from 'react'
import { Modal, Form, Row, Col, Button, Alert } from 'react-bootstrap'
import api from '../../api/client'
import { getError } from '../../api/client'

const UNITS = ['piece', 'meter', 'box', 'bag', 'packet', 'roll', 'liter', 'kg', 'carton']

const empty = {
  name: '', sku: '', barcode: '', category: '', brand: '', description: '',
  unit: 'piece', buyingPrice: '', sellingPrice: '', quantity: 0,
  minStockLevel: 5, supplier: '', location: '', status: 'ACTIVE'
}

export default function ProductForm({ show, onClose, onSaved, product }) {
  const isEdit = Boolean(product)
  const [form, setForm] = useState(empty)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!show) return
    setError('')
    setImageFile(null)
    setPreview(null)
    if (product) {
      const { _id, image, createdAt, updatedAt, stockState, __v, ...rest } = product
      setForm({
        ...empty,
        ...rest,
        category: rest.category?._id || rest.category || '',
        supplier: rest.supplier?._id || rest.supplier || ''
      })
      if (image) setPreview(image)
    } else {
      setForm(empty)
    }
    Promise.all([
      api.get('/categories'),
      api.get('/suppliers', { params: { limit: 100 } })
    ]).then(([catRes, supRes]) => {
      setCategories(catRes.data.data.categories)
      setSuppliers(supRes.data.data.suppliers)
    }).catch(() => {})
  }, [show, product])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  // Fetch an auto-generated SKU suggestion for the selected category
  const suggestSku = async (categoryId) => {
    try {
      const { data } = await api.get('/products/next-sku', { params: categoryId ? { categoryId } : {} })
      setForm((f) => ({ ...f, sku: data.data.sku }))
    } catch { /* keep manual entry */ }
  }

  const onCategoryChange = (e) => {
    const categoryId = e.target.value
    setForm((f) => ({ ...f, category: categoryId }))
    if (!isEdit && !form.sku.trim()) suggestSku(categoryId)
  }

  const pickImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) payload.append(k, v)
      })
      if (imageFile) payload.append('image', imageFile)
      if (isEdit) {
        await api.put(`/products/${product._id}`, payload)
      } else {
        await api.post('/products', payload)
      }
      onSaved()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onHide={onClose} centered size="lg" backdrop="static">
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">
            <i className="bi bi-box-seam me-2 text-primary" />
            {isEdit ? 'Edit Product' : 'Add Product'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <Row className="g-3">
            <Col md={8}>
              <Form.Group>
                <Form.Label>Product Name *</Form.Label>
                <Form.Control value={form.name} onChange={set('name')} required placeholder="e.g. PVC Pipe 25mm" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>SKU / Code</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control value={form.sku} onChange={set('sku')} placeholder="Auto-generates if empty" style={{ textTransform: 'uppercase' }} />
                  {!isEdit && (
                    <Button variant="outline-primary" type="button" className="flex-shrink-0" title="Generate code" onClick={() => suggestSku(form.category)}>
                      <i className="bi bi-magic" />
                    </Button>
                  )}
                </div>
                <Form.Text muted>Leave empty and the system creates a unique code from the category (e.g. PVC-0001).</Form.Text>
              </Form.Group>
            </Col>

            <Col md={4}>
              <Form.Group>
                <Form.Label>Category *</Form.Label>
                <Form.Select value={form.category} onChange={onCategoryChange} required>
                  <option value="">-- Select --</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.parent ? `${c.parent.name} → ${c.name}` : c.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Brand</Form.Label>
                <Form.Control value={form.brand} onChange={set('brand')} placeholder="e.g. Nile, Tuff" />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Barcode</Form.Label>
                <Form.Control value={form.barcode} onChange={set('barcode')} placeholder="Scan or type..." />
              </Form.Group>
            </Col>

            <Col md={3}>
              <Form.Group>
                <Form.Label>Unit *</Form.Label>
                <Form.Select value={form.unit} onChange={set('unit')}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Buying Price *</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={form.buyingPrice} onChange={set('buyingPrice')} required />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Selling Price *</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={form.sellingPrice} onChange={set('sellingPrice')} required />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Min Stock Level</Form.Label>
                <Form.Control type="number" min="0" value={form.minStockLevel} onChange={set('minStockLevel')} />
              </Form.Group>
            </Col>

            {!isEdit && (
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Opening Quantity</Form.Label>
                  <Form.Control type="number" min="0" value={form.quantity} onChange={set('quantity')} />
                  <Form.Text muted>Recorded as an opening-stock transaction.</Form.Text>
                </Form.Group>
              </Col>
            )}
            <Col md={isEdit ? 6 : 5}>
              <Form.Group>
                <Form.Label>Supplier</Form.Label>
                <Form.Select value={form.supplier} onChange={set('supplier')}>
                  <option value="">-- None --</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Storage Location</Form.Label>
                <Form.Control value={form.location} onChange={set('location')} placeholder="e.g. Shelf A2" />
              </Form.Group>
            </Col>

            <Col md={12}>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.description} onChange={set('description')} />
              </Form.Group>
            </Col>

            <Col md={12}>
              <Form.Group>
                <Form.Label>Product Image</Form.Label>
                <div className="d-flex align-items-center gap-3">
                  {preview && <img src={preview} alt="preview" className="border rounded" style={{ width: 64, height: 64, objectFit: 'contain', background: '#f6f8fa' }} />}
                  <Form.Control type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickImage} style={{ maxWidth: 320 }} />
                </div>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="bi bi-check-lg me-1" />Save Product</>}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
