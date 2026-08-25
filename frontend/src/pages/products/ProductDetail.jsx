import { useEffect, useState } from 'react'
import { Card, Row, Col, Badge, Button, Table } from 'react-bootstrap'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import StatusBadge from '../../components/common/StatusBadge'
import Loading from '../../components/common/Loading'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [movements, setMovements] = useState([])

  useEffect(() => {
    api.get(`/products/${id}`).then((r) => setProduct(r.data.data.product)).catch(() => navigate('/products'))
    api.get('/stock/movements', { params: { product: id, limit: 20 } })
      .then((r) => setMovements(r.data.data.transactions))
      .catch(() => {})
  }, [id, navigate])

  if (!product) return <Loading full />

  const Info = ({ label, value }) => (
    <div className="d-flex justify-content-between border-bottom py-2">
      <span className="text-muted small">{label}</span>
      <span className="small fw-semibold text-end">{value || '-'}</span>
    </div>
  )

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-box-seam me-2" />{product.name}
        </h4>
        <Button variant="light" className="border" onClick={() => navigate('/products')}>
          <i className="bi bi-arrow-left me-1" />Back
        </Button>
      </div>

      <Row className="g-3">
        <Col lg={4}>
          <Card className="mb-3">
            <Card.Body className="text-center">
              {product.image ? (
                <img src={product.image} alt={product.name} className="img-fluid rounded" style={{ maxHeight: 220, objectFit: 'contain' }} />
              ) : (
                <div className="d-flex align-items-center justify-content-center bg-light rounded" style={{ height: 200 }}>
                  <i className="bi bi-box fs-1 text-secondary opacity-50" />
                </div>
              )}
              <hr />
              <div className="d-flex justify-content-center gap-2">
                <StatusBadge value={product.stockState} />
                <Badge bg="" className={product.status === 'ACTIVE' ? 'badge-soft-success' : 'badge-soft-secondary'}>{product.status}</Badge>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className="bg-white fw-semibold small">Details</Card.Header>
            <Card.Body className="py-1">
              <Info label="SKU" value={<code>{product.sku}</code>} />
              <Info label="Barcode" value={product.barcode} />
              <Info label="Category" value={product.category?.parent ? `${product.category.parent.name} → ${product.category.name}` : product.category?.name} />
              <Info label="Brand" value={product.brand} />
              <Info label="Unit" value={product.unit} />
              <Info label="Buying Price" value={`${Number(product.buyingPrice).toLocaleString()} RWF`} />
              <Info label="Selling Price" value={`${Number(product.sellingPrice).toLocaleString()} RWF`} />
              <Info label="Current Quantity" value={<span className={product.quantity === 0 ? 'text-danger' : product.quantity <= product.minStockLevel ? 'text-warning' : 'text-success'}>{product.quantity}</span>} />
              <Info label="Min Stock Level" value={product.minStockLevel} />
              <Info label="Supplier" value={product.supplier?.name} />
              <Info label="Location" value={product.location} />
              <Info label="Created" value={new Date(product.createdAt).toLocaleDateString()} />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          <Card>
            <Card.Header className="bg-white fw-semibold">
              <i className="bi bi-arrow-left-right me-2 text-primary" />Stock Movement History
            </Card.Header>
            <Table size="sm" hover responsive className="align-middle mb-0">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Qty</th><th>Change</th><th>Reason / Reference</th><th>By</th></tr>
              </thead>
              <tbody>
                {movements.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No stock movements yet</td></tr>
                )}
                {movements.map((m) => {
                  const diff = m.newQuantity - m.previousQuantity
                  return (
                    <tr key={m._id}>
                      <td className="small">{new Date(m.createdAt).toLocaleString()}</td>
                      <td><Badge bg="" className={`badge-soft-${diff >= 0 ? 'success' : 'danger'}`}>{m.type.replace(/_/g, ' ')}</Badge></td>
                      <td>{Math.abs(m.quantity)}</td>
                      <td className={`fw-semibold ${diff >= 0 ? 'text-success' : 'text-danger'}`}>{diff > 0 ? '+' : ''}{diff}</td>
                      <td className="small">{m.reason}<br /><code className="text-muted" style={{ fontSize: '0.7rem' }}>{m.reference}</code></td>
                      <td className="small">{m.performedBy?.fullName}</td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </Card>
          {product.description && (
            <Card body className="mt-3">
              <strong className="small d-block mb-1">Description</strong>
              <span className="text-muted small">{product.description}</span>
            </Card>
          )}
          <Link to="/products" className="btn btn-link btn-sm mt-3 ps-0">← All products</Link>
        </Col>
      </Row>
    </div>
  )
}
