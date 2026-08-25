import { useCallback, useEffect, useState } from 'react'
import { Card, Form, Badge } from 'react-bootstrap'
import api from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [byMethod, setByMethod] = useState({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('ALL')
  const [type, setType] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      if (method !== 'ALL') params.method = method
      if (type !== 'ALL') params.type = type
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/payments', { params })
      setPayments(data.data.payments)
      setByMethod(data.data.byMethod || {})
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, method, type, from, to])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-wallet2 me-2" />Payment History <span className="text-muted fs-6">({total})</span>
      </h4>

      <Card body className="mb-3">
        <div className="d-flex flex-wrap gap-3 small">
          <span><Badge bg="" className="badge-soft-success me-1">CASH</Badge>{formatMoney(byMethod.CASH || 0)}</span>
          <span><Badge bg="" className="badge-soft-info me-1">MOMO</Badge>{formatMoney(byMethod.MOMO || 0)}</span>
          <span><Badge bg="" className="badge-soft-primary me-1">BANK</Badge>{formatMoney(byMethod.BANK || 0)}</span>
        </div>
      </Card>

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control size="sm" placeholder="Search receipt #, customer or reference..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 260 }} />
          <Form.Select size="sm" value={method} onChange={(e) => { setMethod(e.target.value); setPage(1) }} style={{ maxWidth: 140 }}>
            {['ALL', 'CASH', 'MOMO', 'BANK'].map((m) => <option key={m} value={m}>{m === 'ALL' ? 'All Methods' : m}</option>)}
          </Form.Select>
          <Form.Select size="sm" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} style={{ maxWidth: 190 }}>
            {['ALL', 'SALE_PAYMENT', 'LOAN_REPAYMENT'].map((tp) => <option key={tp} value={tp}>{tp === 'ALL' ? 'All Types' : tp.replace(/_/g, ' ')}</option>)}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'paymentNumber', label: 'Receipt #', render: (p) => <strong>{p.paymentNumber}</strong> },
            { key: 'createdAt', label: 'Date', render: (p) => new Date(p.createdAt).toLocaleString() },
            { key: 'customerName', label: 'Customer', render: (p) => (
              <span className="small">{p.customerName}<br /><small className="text-muted">{p.customer?.phone}</small></span>
            )},
            { key: 'amount', label: 'Amount', render: (p) => <strong className="text-success">{formatMoney(p.amount)}</strong> },
            { key: 'method', label: 'Method', render: (p) => <StatusBadge value={p.method} /> },
            { key: 'type', label: 'Type', render: (p) => (
              <Badge bg="" className={p.type === 'LOAN_REPAYMENT' ? 'badge-soft-warning' : 'badge-soft-info'}>{p.type.replace(/_/g, ' ')}</Badge>
            )},
            { key: 'reference', label: 'Reference', render: (p) => p.reference ? <code className="small">{p.reference}</code> : '-' },
            { key: 'loan', label: 'Loan', render: (p) => p.loan?.loanNumber ? <code className="small">{p.loan.loanNumber}</code> : '-' },
            { key: 'receivedBy', label: 'Received By', render: (p) => <span className="small">{p.receivedBy?.fullName}</span> }
          ]}
          data={payments}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>
    </div>
  )
}
