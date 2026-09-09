import { useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Table, Button, Alert } from 'react-bootstrap'
import { useParams, useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import Loading from '../../components/common/Loading'
import { formatMoney } from '../../context/LanguageContext'

export default function CustomerLoanDetail() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    api.get(`/loans/customer/${customerId}`)
      .then((r) => setData(r.data.data))
      .catch((e) => {
        setError(getError(e))
        setData(null)
      })
  }
  useEffect(load, [customerId])

  // Flatten every loan item into a single row for display and printing.
  const rows = useMemo(() => {
    if (!data) return []
    const out = []
    data.loans.forEach((loan) => {
      const items = loan.items && loan.items.length
        ? loan.items
        : [{ productName: '(no items)', quantity: 1, unitPrice: loan.totalAmount || 0 }]
      items.forEach((it) => {
        out.push({
          loan,
          date: loan.createdAt,
          productName: it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
          loanNumber: loan.loanNumber,
          status: loan.status
        })
      })
    })
    return out
  }, [data])

  if (!data && !error) return <Loading full />

  const customer = data?.customer || {}
  const totals = data?.totals || { loanCount: 0, totalAmount: 0, amountPaid: 0, outstandingBalance: 0 }
  const customerIdShort = customerId && String(customerId).slice(-6).toUpperCase()

  const print = () => window.print()

  return (
    <div>
      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 no-print">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-person-lines-fill me-2" />Customer Loan History
        </h4>
        <div className="d-flex gap-2">
          <Button variant="light" className="border" onClick={() => navigate('/loans')}><i className="bi bi-arrow-left me-1" />Back</Button>
          <Button variant="primary" onClick={print}><i className="bi bi-printer me-1" />Print Loan Statement</Button>
        </div>
      </div>

      {data && (
        <div className="invoice-sheet shadow-sm">
          {/* Company header */}
          <div className="text-center border-bottom pb-3 mb-4">
            <h4 className="fw-bold mb-1" style={{ color: '#0d3b66' }}>BRILLIANT CONSTRUCTION AND MATERIAL LTD</h4>
            <div className="small text-muted">Customer Loan Statement</div>
          </div>

          {/* Customer information */}
          <Row className="g-2 mb-4">
            <Col md={6}>
              <div className="small"><strong>Customer:</strong> {customer.name || customerName()}</div>
              <div className="small"><strong>Phone:</strong> {customer.phone || customerPhone()}</div>
              <div className="small"><strong>Customer ID:</strong> <code>{customerIdShort}</code></div>
            </Col>
            <Col md={6} className="text-md-end">
              <div className="small"><strong>Statement Date:</strong> {new Date().toLocaleDateString()}</div>
              <div className="small"><strong>Active Loans:</strong> {totals.loanCount}</div>
            </Col>
          </Row>

          {/* Customer summary cards */}
          <Row className="g-3 mb-4">
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Total Loans</div><div className="fw-bold">{totals.loanCount}</div></Card></Col>
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Total Borrowed</div><div className="fw-bold">{formatMoney(totals.totalAmount)}</div></Card></Col>
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Total Paid</div><div className="fw-bold text-success">{formatMoney(totals.amountPaid)}</div></Card></Col>
            <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Remaining Balance</div><div className={`fw-bold ${totals.outstandingBalance > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(totals.outstandingBalance)}</div></Card></Col>
          </Row>

          {/* Loan transactions */}
          <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66' }}>Loan Transactions</h6>
          <Table size="sm" hover responsive bordered className="mb-3">
            <thead>
              <tr>
                <th>Date</th>
                <th>Loan #</th>
                <th>Product</th>
                <th className="text-center">Quantity</th>
                <th className="text-end">Unit Price</th>
                <th className="text-end">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-3">No loan transactions.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="small text-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="small"><code>{r.loanNumber}</code></td>
                  <td className="small">{r.productName}</td>
                  <td className="text-center small">{r.quantity}</td>
                  <td className="text-end small">{formatMoney(r.unitPrice)}</td>
                  <td className="text-end fw-semibold">{formatMoney(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Totals */}
          <div className="d-flex justify-content-end">
            <table className="table table-sm small mb-0" style={{ maxWidth: 360 }}>
              <tbody>
                <tr>
                  <td className="text-muted">Total Amount Borrowed</td>
                  <td className="text-end fw-semibold">{formatMoney(totals.totalAmount)}</td>
                </tr>
                <tr>
                  <td className="text-muted">Total Amount Paid</td>
                  <td className="text-end fw-semibold text-success">{formatMoney(totals.amountPaid)}</td>
                </tr>
                <tr className="table-warning">
                  <td><strong>Remaining Balance</strong></td>
                  <td className="text-end fw-bold text-danger">{formatMoney(totals.outstandingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <Row className="mt-5 pt-2 no-print">
            <Col md={6}>
              <div className="small text-muted mb-5">Customer Signature</div>
              <hr />
            </Col>
            <Col md={6}>
              <div className="small text-muted mb-5">Authorized Staff / Admin Signature</div>
              <hr />
            </Col>
          </Row>
        </div>
      )}
    </div>
  )

  function customerName() {
    return rows.length ? rows[0].loan.customerName : 'Unknown'
  }
  function customerPhone() {
    return rows.length ? rows[0].loan.customerPhone : '-'
  }
}
