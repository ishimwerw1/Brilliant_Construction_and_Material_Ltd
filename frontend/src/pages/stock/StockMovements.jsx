import { useCallback, useEffect, useState } from 'react'
import { Card, Form, Badge, Button, Alert } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'

const TYPES = ['ALL', 'OPENING_STOCK', 'STOCK_IN', 'SALE', 'SALE_CANCEL', 'RETURN', 'DAMAGED', 'LOST', 'ADJUSTMENT', 'STOCK_IN_REVERSE', 'ADJUSTMENT_REVERSE']

const badgeFor = (type) => ({
  STOCK_IN: 'success', OPENING_STOCK: 'success', RETURN: 'success',
  SALE: 'info', SALE_CANCEL: 'secondary',
  DAMAGED: 'danger', LOST: 'danger', ADJUSTMENT: 'warning',
  STOCK_IN_REVERSE: 'danger', ADJUSTMENT_REVERSE: 'warning'
}[type] || 'secondary')

export default function StockMovements() {
  const { hasPermission } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [type, setType] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [toast, setToast] = useState(null)
  const [deletingMove, setDeletingMove] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

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

  const canDelete = (m) => m.type === 'STOCK_IN' || m.type === 'ADJUSTMENT'

  const confirmDelete = async () => {
    setDeleteLoading(true)
    try {
      const { data } = await api.delete(`/stock/movements/${deletingMove._id}`)
      setDeletingMove(null)
      setToast({ type: 'success', msg: data.message })
      load()
    } catch (err) {
      setToast({ type: 'danger', msg: getError(err) })
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-arrow-left-right me-2" />Stock Movement History
      </h4>
      {toast && <Alert variant={toast.type} dismissible onClose={() => setToast(null)} className="py-2 small mb-3">{toast.msg}</Alert>}
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
            { key: 'performedBy', label: 'By', render: (m) => <span className="small">{m.performedBy?.fullName}</span> },
            { key: 'actions', label: '', render: (m) => hasPermission('stock.adjust') && canDelete(m) && (
              <Button size="sm" variant="light" className="border text-danger" onClick={() => setDeletingMove(m)} title={`Permanently delete this ${m.type.replace(/_/g, ' ')} and reverse its stock effect`}>
                <i className="bi bi-trash" />
              </Button>
            )}
          ]}
          data={transactions}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      <ConfirmDialog
        show={Boolean(deletingMove)}
        title="Delete Stock Movement"
        message={`Delete this ${deletingMove?.type?.replace(/_/g, ' ') || 'movement'} for "${deletingMove?.productName || ''}"? The product's stock will be reversed to before this movement. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteLoading}
        onClose={() => setDeletingMove(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
