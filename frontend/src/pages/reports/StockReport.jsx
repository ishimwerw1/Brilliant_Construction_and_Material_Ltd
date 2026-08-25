import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Badge } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

export default function StockReport() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/reports/stock').then((r) => setData(r.data.data))
  }, [])

  if (!data) return <Loading full />
  const v = data.valuation

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-boxes me-2" />Stock Report</h4>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('stock-report', data.products, [
            { key: 'name', label: 'Product' }, { key: 'sku', label: 'SKU' },
            { key: (r) => r.category?.name || '', label: 'Category' },
            { key: 'quantity', label: 'Quantity' }, { key: 'unit', label: 'Unit' },
            { key: 'minStockLevel', label: 'Min Level' },
            { key: 'buyingPrice', label: 'Buying Price' }, { key: 'sellingPrice', label: 'Selling Price' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={3}><StatCard icon="bi-boxes" label="Total Units" value={v.totalUnits.toLocaleString()} color="primary" /></Col>
        <Col md={3}><StatCard icon="bi-bank" label="Stock Value (Cost)" value={formatMoney(v.stockValueCost)} color="info" /></Col>
        <Col md={3}><StatCard icon="bi-tag" label="Stock Value (Retail)" value={formatMoney(v.stockValueRetail)} color="success" /></Col>
        <Col md={3}><StatCard icon="bi-exclamation-triangle" label="Alerts" value={`${data.lowStock.length} low · ${data.outOfStock.length} out`} color="warning" /></Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={6}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold"><Badge bg="" className="badge-soft-warning">LOW STOCK</Badge> ({data.lowStock.length})</Card.Title>
            <Table size="sm" hover className="mb-0">
              <thead><tr><th>Product</th><th>Qty</th><th>Min</th></tr></thead>
              <tbody>
                {data.lowStock.slice(0, 8).map((p) => (
                  <tr key={p._id}><td>{p.name}</td><td className="fw-bold text-warning">{p.quantity}</td><td>{p.minStockLevel}</td></tr>
                ))}
                {data.lowStock.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">None</td></tr>}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={6}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold"><Badge bg="" className="badge-soft-danger">OUT OF STOCK</Badge> ({data.outOfStock.length})</Card.Title>
            <Table size="sm" hover className="mb-0">
              <thead><tr><th>Product</th><th>Min Level</th><th>Status</th></tr></thead>
              <tbody>
                {data.outOfStock.slice(0, 8).map((p) => (
                  <tr key={p._id}><td>{p.name}</td><td>{p.minStockLevel}</td><td><StatusBadge value="OUT_OF_STOCK" /></td></tr>
                ))}
                {data.outOfStock.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">None</td></tr>}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>

      <Card body>
        <Card.Title className="fs-6 fw-semibold">Current Stock — All Products</Card.Title>
        <div className="table-responsive" style={{ maxHeight: 420, overflowY: 'auto' }}>
          <Table size="sm" striped hover className="mb-0">
            <thead>
              <tr><th>Product</th><th>SKU</th><th>Category</th><th>Qty</th><th>Unit</th><th>Buy</th><th>Sell</th><th>Value (Cost)</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p._id}>
                  <td className="small fw-semibold">{p.name}</td>
                  <td><code style={{ fontSize: '0.7rem' }}>{p.sku}</code></td>
                  <td className="small">{p.category?.name || '-'}</td>
                  <td className={`fw-bold ${p.quantity === 0 ? 'text-danger' : p.quantity <= p.minStockLevel ? 'text-warning' : ''}`}>{p.quantity}</td>
                  <td className="small">{p.unit}</td>
                  <td>{Number(p.buyingPrice).toLocaleString()}</td>
                  <td>{Number(p.sellingPrice).toLocaleString()}</td>
                  <td>{formatMoney(p.quantity * p.buyingPrice)}</td>
                  <td><StatusBadge value={p.stockState} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
