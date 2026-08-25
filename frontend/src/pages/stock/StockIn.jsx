import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Form, Button, Alert, Table, Badge } from 'react-bootstrap'
import api, { getError } from '../../api/client'

export default function StockIn() {
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState(`GRN-${Date.now().toString().slice(-6)}`)
  const [lines, setLines] = useState([{ product: '', quantity: '', buyingPrice: '' }])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/products', { params: { limit: 200, status: 'ACTIVE' } }),
      api.get('/suppliers', { params: { limit: 100 } })
    ]).then(([p, s]) => {
      setProducts(p.data.data.products)
      setSuppliers(s.data.data.suppliers)
    }).catch((e) => setError(getError(e)))
  }, [])

  const addLine = () => setLines([...lines, { product: '', quantity: '', buyingPrice: '' }])
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i, field, value) => {
    const next = [...lines]
    next[i] = { ...next[i], [field]: value }
    if (field === 'product') {
      const p = products.find((x) => x._id === value)
      if (p) next[i].buyingPrice = p.buyingPrice
    }
    setLines(next)
  }

  const totalValue = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.buyingPrice) || 0), 0),
    [lines]
  )

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(null)
    const items = lines
      .filter((l) => l.product && Number(l.quantity) > 0)
      .map((l) => ({ product: l.product, quantity: Number(l.quantity), buyingPrice: l.buyingPrice === '' ? undefined : Number(l.buyingPrice) }))
    if (items.length === 0) {
      setError('Add at least one product line with a quantity.')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.post('/stock/in', { supplier: supplier || undefined, items, reference })
      setSuccess(data.data)
      setLines([{ product: '', quantity: '', buyingPrice: '' }])
      setReference(`GRN-${Date.now().toString().slice(-6)}`)
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-box-arrow-in-down me-2" />Stock In — Receive Goods
      </h4>

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          <strong>{success.reference}</strong> recorded:{' '}
          {success.results.map((r) => `${r.product} (${r.previousQuantity} → ${r.newQuantity})`).join(', ')}
        </Alert>
      )}

      <Form onSubmit={submit}>
        <Row className="g-3">
          <Col md={5}>
            <Card body>
              <Form.Group className="mb-3">
                <Form.Label>GRN / Reference</Form.Label>
                <Form.Control value={reference} onChange={(e) => setReference(e.target.value)} required />
              </Form.Group>
              <Form.Group>
                <Form.Label>Received From (Supplier)</Form.Label>
                <Form.Select value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                  <option value="">-- None --</option>
                  {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </Form.Select>
              </Form.Group>
              <hr />
              <div className="d-flex justify-content-between small text-muted">
                <span>Total receipt value:</span>
                <strong className="text-dark">{totalValue.toLocaleString()} RWF</strong>
              </div>
            </Card>
          </Col>

          <Col md={7}>
            <Card body>
              <Table size="sm" className="align-middle mb-2">
                <thead>
                  <tr><th style={{ width: '45%' }}>Product</th><th>Quantity</th><th>Buying Price</th><th></th></tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td>
                        <Form.Select size="sm" value={line.product} onChange={(e) => updateLine(i, 'product', e.target.value)} required>
                          <option value="">-- Select product --</option>
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>{p.name} ({p.sku}) — stock: {p.quantity}</option>
                          ))}
                        </Form.Select>
                      </td>
                      <td>
                        <Form.Control size="sm" type="number" min="1" value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} required placeholder="Qty" />
                      </td>
                      <td>
                        <Form.Control size="sm" type="number" min="0" step="0.01" value={line.buyingPrice} onChange={(e) => updateLine(i, 'buyingPrice', e.target.value)} placeholder="RWF" />
                      </td>
                      <td>
                        {lines.length > 1 && (
                          <Button size="sm" variant="link" className="text-danger p-0" onClick={() => removeLine(i)}>
                            <i className="bi bi-x-lg" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Button variant="outline-primary" size="sm" onClick={addLine}><i className="bi bi-plus-lg me-1" />Add line</Button>
            </Card>

            {error && <Alert variant="danger" className="mt-3 py-2 small">{error}</Alert>}

            <div className="d-flex justify-content-end mt-3 gap-2">
              <Badge bg="" className="badge-soft-info align-self-center">Previous + Stock In = New Stock</Badge>
              <Button type="submit" disabled={saving}>
                {saving ? <><span className="spinner-border spinner-border-sm me-1" />Recording...</> : <><i className="bi bi-check-lg me-1" />Receive Stock</>}
              </Button>
            </div>
          </Col>
        </Row>
      </Form>
    </div>
  )
}
