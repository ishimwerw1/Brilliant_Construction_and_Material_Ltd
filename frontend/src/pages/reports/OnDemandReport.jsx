import { useEffect, useState } from 'react'
import { Card, Row, Col, Form, Button, Table } from 'react-bootstrap'
import api from '../../api/client'
import Loading from '../../components/common/Loading'
import StatCard from '../../components/common/StatCard'
import { formatMoney } from '../../context/LanguageContext'

export default function OnDemandReport() {
  const [data, setData] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = () => {
    const params = {}
    if (from) params.from = from
    if (to) params.to = to
    api.get('/reports/on-demand', { params }).then((r) => setData(r.data.data))
  }

  useEffect(load, [from, to])

  if (!data) return <Loading full />
  const s = data.summary

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}><i className="bi bi-shuffle me-2" />On-Demand Report</h4>
        <div className="d-flex gap-2 flex-wrap">
          <Form.Control size="sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 150 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 150 }} />
          <Button size="sm" variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />PDF</Button>
        </div>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-arrow-left-right" label="Transactions" value={s.count} color="primary" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-graph-up" label="Revenue" value={formatMoney(s.revenue)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-receipt" label="Cost" value={formatMoney(s.cost)} color="warning" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-piggy-bank" label="Profit" value={formatMoney(s.profit)} color="info" /></Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}><StatCard icon="bi-cash-stack" label="Received" value={formatMoney(s.received)} color="success" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-hourglass-split" label="Customer O/S" value={formatMoney(s.customerOutstanding)} color="danger" /></Col>
        <Col xs={6} lg={3}><StatCard icon="bi-truck" label="Supplier O/S" value={formatMoney(s.supplierBalance)} color="warning" /></Col>
      </Row>

      <Card body>
        <Card.Title className="fs-6 fw-semibold">By Supplier</Card.Title>
        <div className="table-responsive">
          <Table size="sm" hover className="mb-0">
            <thead><tr><th>Supplier</th><th className="text-end">Transactions</th><th className="text-end">Cost</th><th className="text-end">Profit</th></tr></thead>
            <tbody>
              {(data.bySupplier || []).length === 0 && <tr><td colSpan={4} className="text-center text-muted py-3">No on-demand transactions in this period</td></tr>}
              {(data.bySupplier || []).map((row) => (
                <tr key={row._id}>
                  <td>{row.name}</td>
                  <td className="text-end">{row.count}</td>
                  <td className="text-end text-muted">{formatMoney(row.cost)}</td>
                  <td className={`text-end fw-semibold ${row.profit >= 0 ? 'text-success' : 'text-danger'}`}>{row.profit >= 0 ? '+' : ''}{formatMoney(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  )
}