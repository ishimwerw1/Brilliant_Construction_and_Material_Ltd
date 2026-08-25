import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Form, Badge } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'

export default function FinancialReport() {
  const [data, setData] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = () => {
    const params = {}
    if (from) params.from = from
    if (to) params.to = to
    api.get('/reports/financial', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [from, to])

  if (!data) return <Loading full />

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-bank me-2" />Financial Report</h4>
        <div className="d-flex gap-2 flex-wrap">
          <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={3}><StatCard icon="bi-graph-up" label="Total Sales" value={formatMoney(data.sales.totalSales)} color="primary" sub={`${data.sales.salesCount} sales`} /></Col>
        <Col md={3}><StatCard icon="bi-cash-stack" label="Amount Received" value={formatMoney(data.sales.totalPaid)} color="success" /></Col>
        <Col md={3}><StatCard icon="bi-tags" label="Total Discounts" value={formatMoney(data.sales.totalDiscounts)} color="warning" /></Col>
        <Col md={3}><StatCard icon="bi-bar-chart-line" label="Gross Profit (est.)" value={formatMoney(data.grossProfit)} color="info" sub={`COGS: ${formatMoney(data.costOfGoodsSold)}`} /></Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={4}><StatCard icon="bi-arrow-up-right-circle" label="Credit Given" value={formatMoney(data.loans.creditGiven)} color="warning" /></Col>
        <Col md={4}><StatCard icon="bi-arrow-down-left-circle" label="Credit Repaid" value={formatMoney(data.loans.creditRepaid)} color="success" /></Col>
        <Col md={4}><StatCard icon="bi-cash-coin" label="Credit Outstanding" value={formatMoney(data.loans.creditOutstanding)} color="danger" /></Col>
      </Row>

      <Row className="g-3">
        <Col lg={6}>
          <Card body>
            <Card.Title className="fs-6 fw-semibold">Payments by Method</Card.Title>
            <Table size="sm" hover className="mb-0">
              <thead><tr><th>Method</th><th>Transactions</th><th>Total</th></tr></thead>
              <tbody>
                {data.paymentsByMethod.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No payments in this period</td></tr>}
                {data.paymentsByMethod.map((p) => (
                  <tr key={p._id}>
                    <td><StatusBadge value={p._id} /></td>
                    <td>{p.count}</td>
                    <td className="fw-semibold">{formatMoney(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
        <Col lg={6}>
          <Card body className="bg-light h-100">
            <h6 className="fw-semibold"><i className="bi bi-info-circle me-2 text-primary" />Notes</h6>
            <ul className="small text-muted ps-3 mb-0">
              <li className="mb-2">Gross profit is estimated using each product's current buying price at time of aggregation.</li>
              <li className="mb-2">Credit outstanding = unpaid balances on non-cancelled loans.</li>
              <li>Use date filters to narrow the period. Print to PDF for record keeping.</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
