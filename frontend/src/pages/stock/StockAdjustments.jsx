import { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Alert, Table } from 'react-bootstrap'
import api, { getError } from '../../api/client'

export default function StockAdjustments() {
  const [products, setProducts] = useState([])
  const [productId, setProductId] = useState('')
  const [actualQty, setActualQty] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } })
      .then((r) => setProducts(r.data.data.products))
      .catch((e) => setError(getError(e)))
  }, [])

  const selected = products.find((p) => p._id === productId)
  const diff = selected && actualQty !== '' ? Number(actualQty) - selected.quantity : null

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setSaving(true)
    try {
      const { data } = await api.post('/stock/adjustments', { productId, actualQuantity: Number(actualQty), reason })
      setResult(data.data)
      setProductId('')
      setActualQty('')
      setReason('')
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-sliders me-2" />Stock Adjustment
      </h4>
      <p className="text-muted small">Corrections to system quantities must always be justified. Every adjustment is recorded in the audit log.</p>

      <Row className="g-3">
        <Col lg={6}>
          <Card body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            {result && (
              <Alert variant="success" className="py-2 small">
                Adjusted "{result.productName}": {result.systemQuantity} → {result.actualQuantity} ({result.difference > 0 ? '+' : ''}{result.difference})
              </Alert>
            )}
            <Form onSubmit={submit}>
              <Form.Group className="mb-3">
                <Form.Label>Product *</Form.Label>
                <Form.Select value={productId} onChange={(e) => { setProductId(e.target.value); setActualQty('') }} required>
                  <option value="">-- Select product --</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} ({p.sku}) — system qty: {p.quantity}</option>
                  ))}
                </Form.Select>
              </Form.Group>

              {selected && (
                <Table size="sm" bordered className="mb-3 text-center small">
                  <tbody>
                    <tr>
                      <td className="text-muted">System Quantity</td>
                      <td className="fw-bold">{selected.quantity}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Actual (Counted)</td>
                      <td>
                        <Form.Control size="sm" type="number" min="0" value={actualQty} onChange={(e) => setActualQty(e.target.value)} required style={{ maxWidth: 120, margin: '0 auto' }} />
                      </td>
                    </tr>
                    <tr className={diff === null ? '' : diff === 0 ? '' : diff > 0 ? 'table-success' : 'table-danger'}>
                      <td className="text-muted">Difference</td>
                      <td className="fw-bold">{diff === null || Number.isNaN(diff) ? '-' : `${diff > 0 ? '+' : ''}${diff}`}</td>
                    </tr>
                  </tbody>
                </Table>
              )}

              <Form.Group className="mb-3">
                <Form.Label>Reason *</Form.Label>
                <Form.Control as="textarea" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="e.g. Damaged products, count correction..." />
              </Form.Group>

              <Button type="submit" disabled={saving || !selected || diff === 0}>
                {saving ? <><span className="spinner-border spinner-border-sm me-1" />Adjusting...</> : <><i className="bi bi-check-lg me-1" />Apply Adjustment</>}
              </Button>
            </Form>
          </Card>
        </Col>

        <Col lg={6}>
          <Card body className="h-100 bg-light border-0">
            <h6 className="fw-semibold"><i className="bi bi-info-circle me-2 text-primary" />How adjustments work</h6>
            <ul className="small text-muted ps-3 mb-0">
              <li className="mb-2">The counted quantity replaces the system quantity after review.</li>
              <li className="mb-2">A signed difference is recorded as an <code>ADJUSTMENT</code> stock transaction with previous and new quantities.</li>
              <li className="mb-2">Adjustments require the <code>stock.adjust</code> permission (Manager / Storekeeper / Super Admin).</li>
              <li>Every adjustment appears in <strong>Audit Logs</strong> with the user, old quantity, new quantity and reason.</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
