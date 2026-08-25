import { useEffect, useState } from 'react'
import { Card, Row, Col, Badge, Button } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import Loading from '../../components/common/Loading'

export default function LowStock() {
  const [low, setLow] = useState([])
  const [out, setOut] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/stock/low'), api.get('/stock/out-of-stock')])
      .then(([l, o]) => {
        setLow(l.data.data.products)
        setOut(o.data.data.products)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading full />

  const Table = ({ items, emptyText }) => (
    <div className="table-responsive">
      <table className="table table-sm table-hover align-middle mb-0">
        <thead>
          <tr><th>Product</th><th>SKU</th><th>Qty</th><th>Min</th><th>Category</th><th></th></tr>
        </thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={6} className="text-center text-muted py-4">{emptyText}</td></tr>}
          {items.map((p) => (
            <tr key={p._id}>
              <td className="small fw-semibold">{p.name}</td>
              <td><code className="small">{p.sku}</code></td>
              <td className={`fw-bold ${p.quantity === 0 ? 'text-danger' : 'text-warning'}`}>{p.quantity}</td>
              <td>{p.minStockLevel}</td>
              <td className="small">{p.category?.name || '-'}</td>
              <td><Link to={`/products/${p._id}`} className="btn btn-sm btn-light border"><i className="bi bi-eye" /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-exclamation-triangle me-2" />Stock Alerts
      </h4>
      <Row className="g-3">
        <Col lg={6}>
          <Card className="h-100 border-top border-3" style={{ borderTopColor: '#f9a825' }}>
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <span className="fw-semibold"><i className="bi bi-exclamation-triangle text-warning me-2" />Low Stock</span>
              <Badge bg="" className="badge-soft-warning">{low.length}</Badge>
            </Card.Header>
            <Card.Body className="p-0 pt-2">
              <Table items={low} emptyText="No low-stock products. Well done!" />
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100 border-top border-3" style={{ borderTopColor: '#c0392b' }}>
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <span className="fw-semibold"><i className="bi bi-x-octagon text-danger me-2" />Out of Stock</span>
              <Badge bg="" className="badge-soft-danger">{out.length}</Badge>
            </Card.Header>
            <Card.Body className="p-0 pt-2">
              <Table items={out} emptyText="Nothing is out of stock." />
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Link to="/stock/in" className="btn btn-primary btn-sm mt-3"><i className="bi bi-box-arrow-in-down me-1" />Go to Stock In</Link>
    </div>
  )
}
