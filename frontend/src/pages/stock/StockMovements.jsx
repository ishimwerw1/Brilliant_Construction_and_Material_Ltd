import { useCallback, useEffect, useState } from 'react'
import { Card, Form, Badge } from 'react-bootstrap'
import api from '../../api/client'
import DataTable from '../../components/common/DataTable'

const TYPES = ['ALL', 'OPENING_STOCK', 'STOCK_IN', 'SALE', 'SALE_CANCEL', 'RETURN', 'DAMAGED', 'LOST', 'ADJUSTMENT']

const badgeFor = (type) => ({
  STOCK_IN: 'success', OPENING_STOCK: 'success', RETURN: 'success',
  SALE: 'info', SALE_CANCEL: 'secondary',
  DAMAGED: 'danger', LOST: 'danger', ADJUSTMENT: 'warning'
}[type] || 'secondary')

export default function StockMovements() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 25 }
      if (search) params.search = search
      if (type !== 'ALL') params.type = type
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/stock/movements', { params })
      setTransactions(data.data.transactions)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, type, from, to])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-arrow-left-right me-2" />Stock Movement History
      </h4>
      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control size="sm" placeholder="Search product / reference..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 240 }} />
          <Form.Select size="sm" value={type} onChange={(e) => { setType(e.target.value); setPage(1) }} style={{ maxWidth: 180 }}>
            {TYPES.map((tp) => <option key={tp} value={tp}>{tp === 'ALL' ? 'All Types' : tp.replace(/_/g, ' ')}</option>)}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 160 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 160 }} />
          {(from || to || type !== 'ALL' || search) && (
            <Badge bg="" className="badge-soft-secondary cursor-pointer align-self-center" onClick={() => { setFrom(''); setTo(''); setType('ALL'); setSearch('') }}>
              Clear filters ✕
            </Badge>
          )}
        </div>

        <DataTable
          columns={[
            { key: 'createdAt', label: 'Date', render: (m) => new Date(m.createdAt).toLocaleString() },
            { key: 'type', label: 'Type', render: (m) => <Badge bg="" className={`badge-soft-${badgeFor(m.type)}`}>{m.type.replace(/_/g, ' ')}</Badge> },
            { key: 'productName', label: 'Product', render: (m) => (
              <span className="small"><strong>{m.productName}</strong><br /><code className="text-muted" style={{ fontSize: '0.7rem' }}>{m.sku}</code></span>
            )},
            { key: 'quantity', label: 'Qty', render: (m) => {
              const diff = m.newQuantity - m.previousQuantity
              return <span className={`fw-semibold ${diff >= 0 ? 'text-success' : 'text-danger'}`}>{diff > 0 ? '+' : ''}{diff}</span>
            }},
            { key: 'change', label: 'Change', render: (m) => <span className="small text-muted">{m.previousQuantity} → <strong>{m.newQuantity}</strong></span> },
            { key: 'reason', label: 'Reason / Ref', render: (m) => <span className="small">{m.reason}<br /><code className="text-muted" style={{ fontSize: '0.7rem' }}>{m.reference}</code></span> },
            { key: 'performedBy', label: 'By', render: (m) => <span className="small">{m.performedBy?.fullName}</span> }
          ]}
          data={transactions}
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
