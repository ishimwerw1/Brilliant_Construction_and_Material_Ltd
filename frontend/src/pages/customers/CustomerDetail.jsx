import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Badge } from 'react-bootstrap'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../api/client'
import StatusBadge from '../../components/common/StatusBadge'
import Loading from '../../components/common/Loading'
import { formatMoney } from '../../context/LanguageContext'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get(`/customers/${id}`).then((r) => setData(r.data.data)).catch(() => navigate('/customers'))
  }, [id, navigate])

  if (!data) return <Loading full />
  const { customer, sales, payments, loans } = data

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-person me-2" />{customer.name}
        </h4>
        <Button variant="light" className="border" onClick={() => navigate('/customers')}><i className="bi bi-arrow-left me-1" />Back</Button>
      </div>

      <Row className="g-3 mb-3">
        <Col md={4}><Card body className="text-center"><div className="text-muted small">Total Purchases</div><div className="fs-5 fw-bold">{formatMoney(customer.totalPurchases)}</div></Card></Col>
        <Col md={4}><Card body className="text-center"><div className="text-muted small">Total Paid</div><div className="fs-5 fw-bold text-success">{formatMoney(customer.totalPaid)}</div></Card></Col>
        <Col md={4}><Card body className="text-center"><div className="text-muted small">Outstanding Balance</div><div className={`fs-5 fw-bold ${customer.outstandingBalance > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(customer.outstandingBalance)}</div></Card></Col>
      </Row>

      <Card body className="mb-3">
        <div className="d-flex flex-wrap gap-4 small">
          <span><i className="bi bi-telephone me-1 text-muted" /><code>{customer.phone}</code></span>
          {customer.email && <span><i className="bi bi-envelope me-1 text-muted" />{customer.email}</span>}
          {customer.address && <span><i className="bi bi-geo-alt me-1 text-muted" />{customer.address}</span>}
          <span><i className="bi bi-calendar me-1 text-muted" />Since {new Date(customer.createdAt).toLocaleDateString()}</span>
          <StatusBadge value={customer.status} />
        </div>
      </Card>

      <Row className="g-3">
        <Col lg={6}>
          <Card>
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-receipt me-2 text-primary" />Purchase History</Card.Header>
            <Table size="sm" hover responsive className="mb-0 align-middle">
              <thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
              <tbody>
                {sales.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No purchases yet</td></tr>}
                {sales.map((s) => (
                  <tr key={s._id}>
                    <td><Link to={`/sales/${s._id}`} className="fw-semibold text-decoration-none">{s.saleNumber}</Link></td>
                    <td className="small">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>{formatMoney(s.total)}</td>
                    <td>{formatMoney(s.amountPaid)}</td>
                    <td>{s.status === 'CANCELLED' ? <StatusBadge value="CANCELLED" /> : <StatusBadge value={s.paymentStatus} />}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="mb-3">
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-wallet2 me-2 text-success" />Payment History</Card.Header>
            <Table size="sm" hover responsive className="mb-0 align-middle">
              <thead><tr><th>Receipt</th><th>Date</th><th>Amount</th><th>Method</th><th>Type</th></tr></thead>
              <tbody>
                {payments.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No payments yet</td></tr>}
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td className="small fw-semibold">{p.paymentNumber}</td>
                    <td className="small">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="fw-semibold text-success">{formatMoney(p.amount)}</td>
                    <td><StatusBadge value={p.method} /></td>
                    <td><Badge bg="" className={p.type === 'LOAN_REPAYMENT' ? 'badge-soft-warning' : 'badge-soft-info'}>{p.type.replace(/_/g, ' ')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <Card.Header className="bg-white fw-semibold small"><i className="bi bi-cash-coin me-2 text-danger" />Loan History</Card.Header>
            <Table size="sm" hover responsive className="mb-0 align-middle">
              <thead><tr><th>Loan</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>
                {loans.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-3">No loans</td></tr>}
                {loans.map((l) => (
                  <tr key={l._id}>
                    <td><Link to={`/loans/${l._id}`} className="fw-semibold text-decoration-none">{l.loanNumber}</Link></td>
                    <td>{formatMoney(l.totalAmount)}</td>
                    <td>{formatMoney(l.amountPaid)}</td>
                    <td className="text-danger fw-semibold">{formatMoney(l.outstandingBalance)}</td>
                    <td><StatusBadge value={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
