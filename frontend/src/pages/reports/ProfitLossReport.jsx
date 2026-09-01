import { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Table } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

export default function ProfitLossReport() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState(null)

  const load = () => {
    const params = {}
    if (from) params.from = from
    if (to) params.to = to
    api.get('/reports/financial', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [from, to])

  if (!data) return <Loading full />

  const s = data.sales
  const plRows = [
    { label: 'Sales Revenue', value: s.totalSales, indent: 'text-end' },
    { label: 'Cost of Goods Sold', value: -data.costOfGoodsSold, indent: 'text-end' },
    { label: 'Gross Profit', value: data.grossProfit, emp: true },
    { label: 'Operating Expenses', value: -data.operatingExpenses, indent: 'text-end' },
    { label: 'Net Profit', value: data.netProfit, emp: true }
  ]

  const csvPl = [
    { line: 'Sales Revenue', amount: s.totalSales },
    { line: `- Cost of Goods Sold`, amount: -data.costOfGoodsSold || 0 },
    { line: '= Gross Profit', amount: data.grossProfit || 0 },
    { line: `- Operating Expenses`, amount: -data.operatingExpenses || 0 },
    { line: '= Net Profit', amount: data.netProfit || 0 }
  ]

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-bar-chart-line me-2" />Profit &amp; Loss Report</h4>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 140 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 140 }} />
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('profit-loss-report', csvPl, [
            { key: 'line', label: 'Line' }, { key: 'amount', label: 'Amount' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-cash-stack" label="Total Sales (Revenue)" value={formatMoney(s.totalSales)} color="primary" sub={`${s.salesCount} sales`} /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-box-seam" label="Cost of Goods Sold" value={formatMoney(data.costOfGoodsSold)} color="warning" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-graph-up" label="Gross Profit" value={formatMoney(data.grossProfit)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-wallet2" label="Operating Expenses" value={formatMoney(data.operatingExpenses)} color="danger" /></Col>
        <Col xs={12} lg={2} offset={5}></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col xs={12}><StatCard icon="bi-award" label="Net Profit" value={formatMoney(data.netProfit)} color={data.netProfit >= 0 ? 'success' : 'danger'} /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3 px-4">
              <h6 className="fw-semibold mb-3" style={{ color: '#0d3b66', fontSize: '0.85rem' }}><i className="bi bi-bar-chart-line me-1" />Profit &amp; Loss Statement</h6>
              <div className="pl-sheet">
                {plRows.map((r, i) => (
                  <div key={r.label} className={`d-flex justify-content-between align-items-center py-2 ${i === 2 || i === 4 ? 'border-top fw-bold' : ''}`} style={{ color: r.emp ? '#0d3b66' : '#33475b', fontSize: r.emp ? '0.98rem' : '0.9rem' }}>
                    <span>{r.label}</span>
                    <span className="text-end">{formatMoney(r.value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 small text-muted border-top">
                Amount collected: <span className="fw-semibold" style={{ color: '#1e7e46' }}>{formatMoney(s.totalPaid)}</span> &nbsp;·&nbsp; Discounts given: <span className="fw-semibold">{formatMoney(s.totalDiscounts)}</span>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Row className="g-3 mb-3">
            <Col sm={6}>
              <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
                <Card.Body className="py-3 px-3">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className="bi bi-wallet2" style={{ color: '#c0392b', fontSize: '0.95rem' }} />
                    <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Expenses Detail</span>
                  </div>
                  <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{formatMoney(data.expenses?.total || 0)}</div>
                  <small className="text-muted">{data.expenses?.count || 0} expenses</small>
                </Card.Body>
              </Card>
            </Col>
            <Col sm={6}>
              <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
                <Card.Body className="py-3 px-3">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className="bi bi-cart-check" style={{ color: '#1a6fb5', fontSize: '0.95rem' }} />
                    <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Purchases (Inventory)</span>
                  </div>
                  <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{formatMoney(data.purchases?.total || 0)}</div>
                  <small className="text-muted">Paid: {formatMoney(data.purchases?.paid || 0)} · Credit: {formatMoney(data.purchases?.remaining || 0)}</small>
                </Card.Body>
              </Card>
            </Col>
            <Col sm={6}>
              <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
                <Card.Body className="py-3 px-3">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className="bi bi-arrow-repeat" style={{ color: '#1e7e46', fontSize: '0.95rem' }} />
                    <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Supplier Payments</span>
                  </div>
                  <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{formatMoney(data.supplierPayments?.total || 0)}</div>
                  <small className="text-muted">{data.supplierPayments?.count || 0} payments</small>
                </Card.Body>
              </Card>
            </Col>
            <Col sm={6}>
              <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
                <Card.Body className="py-3 px-3">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <i className="bi bi-cash-coin" style={{ color: '#f9a825', fontSize: '0.95rem' }} />
                    <span className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>Credit Outstanding</span>
                  </div>
                  <div className="fw-bold" style={{ color: '#0d3b66', fontSize: '1.15rem' }}>{formatMoney(data.loans?.creditOutstanding || 0)}</div>
                  <small className="text-muted">Given: {formatMoney(data.loans?.creditGiven || 0)} · Repaid: {formatMoney(data.loans?.creditRepaid || 0)}</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12 }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}>Payments by Method</h6>
              <div className="table-responsive">
                <Table size="sm" hover className="mb-0">
                  <thead><tr><th>Method</th><th className="text-end">Transactions</th><th className="text-end">Total</th></tr></thead>
                  <tbody>
                    {data.paymentsByMethod.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-3">No payments in this period</td></tr>}
                    {data.paymentsByMethod.map((p) => (
                      <tr key={p._id}>
                        <td><i className="bi bi-credit-card me-1 text-muted" style={{ fontSize: '0.8rem' }} />{p._id}</td>
                        <td className="text-end">{p.count}</td>
                        <td className="text-end fw-semibold">{formatMoney(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100" style={{ border: 'none', boxShadow: '0 1px 8px rgba(0,0,0,.08)', borderRadius: 12, background: '#f8fafc' }}>
            <Card.Body className="py-3">
              <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66', fontSize: '0.85rem' }}><i className="bi bi-info-circle me-1 text-primary" />How This P&amp;L Is Structured</h6>
              <ul className="small ps-3 mb-0" style={{ color: '#4a5a6e', lineHeight: 1.7 }}>
                <li className="mb-2"><strong>Sales Revenue</strong> is the total value of goods/services sold (before discounts). Amount collected is shown below the statement.</li>
                <li className="mb-2"><strong>Cost of Goods Sold (COGS)</strong> is estimated from the purchasing cost of goods sold during the period.</li>
                <li className="mb-2"><strong>Operating Expenses</strong> are day-to-day running costs. These are distinct from inventory purchases, which add to COGS rather than operating expense.</li>
                <li className="mb-2"><strong>Supplier Payments / Payables</strong> settle outstanding inventory purchases (credit) and are not operating expenses — they convert credit purchases into cash outflow.</li>
                <li><strong>Loans / Credit</strong> given to customers are separate from the P&amp;L; only the outstanding balance is tracked here as a receivable.</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  )
}