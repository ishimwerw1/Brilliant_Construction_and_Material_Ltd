import { useEffect, useState } from 'react'
import { Modal, Form, Row, Col, Button, Alert, InputGroup } from 'react-bootstrap'
import api, { getError } from '../../api/client'

const UNITS = ['piece', 'meter', 'box', 'bag', 'packet', 'roll', 'liter', 'kg', 'carton']

export default function QuickAddProduct({ show, onClose, onCreated }) {
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState({
    name: '', sku: '', category: '', brand: '', unit: 'piece',
    buyingPrice: '', sellingPrice: '', quantity: 0, minStockLevel: 5, supplier: ''
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!show) return
    setError('')
    setForm((f) => ({
      ...f,
      name: '', sku: '', category: '', brand: '', unit: 'piece',
      buyingPrice: '', sellingPrice: '', quantity: 0, minStockLevel: 5, supplier: ''
    }))
    Promise.all([
      api.get('/categories'),
      api.get('/suppliers', { params: { limit: 100 } })
    ]).then(([catRes, supRes]) => {
      setCategories(catRes.data.data.categories)
      setSuppliers(supRes.data.data.suppliers)
    }).catch(() => {})
  }, [show])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const suggestSku = async (categoryId) => {
    try {
      const { data } = await api.get('/products/next-sku', { params: categoryId ? { categoryId } : {} })
      setForm((f) => ({ ...f, sku: data.data.sku }))
    } catch { /* keep manual entry */ }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const { data } = await api.post('/products', {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        category: form.category,
        brand: form.brand.trim() || undefined,
        unit: form.unit,
        buyingPrice: Number(form.buyingPrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        quantity: Number(form.quantity) || 0,
        minStockLevel: Number(form.minStockLevel) || 5,
        supplier: form.supplier || undefined
      })
      onCreated(data.data.product)
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
          <Modal.Title className="fs-6 fw-bold"><i className="bi bi-box-seam me-2 text-primary" />Quick Add Product</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <Row className="g-3">
            <Col md={8}>
              <Form.Group>
                <Form.Label>Product Name *</Form.Label>
                <Form.Control value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. PVC Pipe 25mm" autoFocus />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>SKU / Code</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Auto if empty" style={{ textTransform: 'uppercase' }} />
                  <Button variant="outline-primary" type="button" className="flex-shrink-0" title="Generate code" onClick={() => suggestSku(form.category)}>
                    <i className="bi bi-magic" />
                  </Button>
                </div>
                <Form.Text muted>Leave empty and the system creates a unique code from the category.</Form.Text>
              </Form.Group>
            </Col>

            <Col md={5}>
              <Form.Group>
                <Form.Label>Category *</Form.Label>
                <Form.Select value={form.category} onChange={(e) => {
                  set('category', e.target.value)
                  if (!form.sku.trim()) suggestSku(e.target.value)
                }} required>
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
                <Form.Control value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Nile, Tuff" />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Unit *</Form.Label>
                <Form.Select value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col md={3}>
              <Form.Group>
                <Form.Label>Buying Price *</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={form.buyingPrice} onChange={(e) => set('buyingPrice', e.target.value)} required />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Selling Price *</Form.Label>
                <Form.Control type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(e) => set('sellingPrice', e.target.value)} required />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Opening Qty</Form.Label>
                <InputGroup size="sm">
                  <Form.Control type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
                </InputGroup>
                <Form.Text muted>If &gt; 0 it is added to stock now.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Min Stock Level</Form.Label>
                <Form.Control type="number" min="0" value={form.minStockLevel} onChange={(e) => set('minStockLevel', e.target.value)} />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group>
                <Form.Label>Supplier</Form.Label>
                <Form.Select value={form.supplier} onChange={(e) => set('supplier', e.target.value)}>
                  <option value="">-- None --</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="bi bi-check-lg me-1" />Create Product</>}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}