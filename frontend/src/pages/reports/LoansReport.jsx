import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Button, Badge } from 'react-bootstrap'
import api from '../../api/client'
import Chart from '../../components/common/Charts'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'
import { downloadCsv } from '../../utils/export'

export default function LoansReport() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/reports/loans').then((r) => setData(r.data.data))
  }, [])

  if (!data) return <Loading full />
  const t = data.totals

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-credit-card-2-front me-2" />Loan Report</h4>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-primary" onClick={() => downloadCsv('overdue-loans', data.overdueLoans, [
            { key: 'loanNumber', label: 'Loan ID' }, { key: 'customerName', label: 'Customer' },
            { key: 'customerPhone', label: 'Phone' }, { key: 'outstandingBalance', label: 'Outstanding' },
            { key: (r) => new Date(r.dueDate).toLocaleDateString(), label: 'Due Date' }
          ])}><i className="bi bi-download me-1" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={3}><StatCard icon="bi-arrow-up-right-circle" label="Total Credit Given" value={formatMoney(t.totalGiven)} color="primary" /></Col>
        <Col md={3}><StatCard icon="bi-check-circle" label="Total Repaid" value={formatMoney(t.totalRepaid)} color="success" /></Col>
        <Col md={3}><StatCard icon="bi-cash-coin" label="Outstanding Debt" value={formatMoney(t.totalOutstanding)} color="danger" /></Col>
        <Col md={3}><StatCard icon="bi-alarm" label="Overdue Loans" value={data.overdueLoans.length} color="warning" /></Col>
      </Row>

      <Row className="g-2 mb-3">
        <Col lg={5}>
          <Card body className="h-100 py-2">
            <Card.Title className="fs-6 fw-semibold mb-1">Loans by Status</Card.Title>
            <Chart type="doughnut" {...{
              data: {
                labels: data.byStatus.map((s) => s._id.replace(/_/g, ' ')),
                datasets: [{ data: data.byStatus.map((s) => s.count), backgroundColor: ['#1a6fb5', '#f9a825', '#1e7e46', '#c0392b', '#6c757d'], borderWidth: 0 }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
            }} height={80} />
          </Card>
        </Col>
        <Col lg={7}>
          <Card body className="h-100 py-2">
            <Card.Title className="fs-6 fw-semibold mb-1">Monthly Repayments</Card.Title>
            <Chart type="bar" {...{
              data: {
                labels: data.repaymentTrend.map((r) => r._id),
                datasets: [{ data: data.repaymentTrend.map((r) => r.total), backgroundColor: '#1e7e46', borderRadius: 4 }]
              },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            }} height={Math.max(120, data.repaymentTrend.length * 24)} />
          </Card>
        </Col>
      </Row>

      <Row className="g-2">
        <Col lg={6}>
          <Card body className="py-2">
            <Card.Title className="fs-6 fw-semibold mb-1">Status Breakdown</Card.Title>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              <Table size="sm" hover className="mb-0">
                <thead><tr><th>Status</th><th>Count</th><th>Outstanding</th></tr></thead>
                <tbody>
                  {data.byStatus.map((s) => (
                    <tr key={s._id}>
                      <td><StatusBadge value={s._id} /></td>
                      <td>{s.count}</td>
                      <td>{formatMoney(s.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
        <Col lg={6}>
          <Card body className="py-2">
            <Card.Title className="fs-6 fw-semibold mb-1"><Badge bg="" className="badge-soft-danger">OVERDUE</Badge> Overdue Loans</Card.Title>
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              <Table size="sm" hover responsive className="mb-0">
                <thead><tr><th>Loan</th><th>Customer</th><th>Balance</th><th>Due</th></tr></thead>
                <tbody>
                  {data.overdueLoans.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-2">No overdue loans</td></tr>}
                  {data.overdueLoans.map((l) => (
                    <tr key={l._id}>
                      <td><code style={{ fontSize: '0.72rem' }}>{l.loanNumber}</code></td>
                      <td className="small">{l.customerName}<br /><small className="text-muted">{l.customerPhone}</small></td>
                      <td className="fw-bold text-danger">{formatMoney(l.outstandingBalance)}</td>
                      <td className="small">{new Date(l.dueDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
