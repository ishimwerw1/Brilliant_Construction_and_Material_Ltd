import { useCallback, useEffect, useState } from 'react'
import { Card, Form, Button, Alert, Badge } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { downloadCsv } from '../../utils/export'
import { useAuth } from '../../context/AuthContext'

export default function Sales() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('ALL')
  const [paymentStatus, setPaymentStatus] = useState('ALL')
  const [saleType, setSaleType] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { hasPermission } = useAuth()

  const [toast, setToast] = useState(null)
  const [deletingSale, setDeletingSale] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const confirmDelete = async () => {
    setDeleteLoading(true)
    try {
      const { data } = await api.delete(`/sales/${deletingSale._id}`)
      setDeletingSale(null)
      setToast({ type: 'success', msg: data.message })
      load()
    } catch (err) {
      setToast({ type: 'danger', msg: getError(err) })
    } finally {
      setDeleteLoading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (search) params.search = search
      if (paymentMethod !== 'ALL') params.paymentMethod = paymentMethod
      if (paymentStatus !== 'ALL') params.paymentStatus = paymentStatus
      if (saleType !== 'ALL') params.saleType = saleType
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/sales', { params })
      setSales(data.data.sales)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } catch (err) {
      console.error(getError(err))
    } finally {
      setLoading(false)
    }
  }, [page, search, paymentMethod, paymentStatus, saleType, from, to])

  useEffect(() => { load() }, [load])

  const exportCsv = () => {
    downloadCsv('sales', sales, [
      { key: 'saleNumber', label: 'Invoice No' },
      { key: (r) => new Date(r.createdAt).toLocaleString(), label: 'Date' },
      { key: (r) => r.customer?.name || r.customerName, label: 'Customer' },
      { key: (r) => r.customer?.phone || '', label: 'Phone' },
      { key: (r) => r.saleType || 'NORMAL', label: 'Type' },
      { key: (r) => r.subtotal, label: 'Subtotal' },
      { key: (r) => r.discount, label: 'Discount' },
      { key: (r) => r.total, label: 'Total' },
      { key: (r) => r.totalCost, label: 'Total Cost' },
      { key: (r) => r.totalProfit, label: 'Profit' },
      { key: (r) => r.amountPaid, label: 'Paid' },
      { key: (r) => r.balance, label: 'Balance' },
      { key: 'paymentMethod', label: 'Method' },
      { key: 'paymentStatus', label: 'Status' },
      { key: (r) => r.cashier?.fullName || '', label: 'Cashier' }
    ])
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-receipt me-2" />Sales <span className="text-muted fs-6">({total})</span>
        </h4>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" size="sm" onClick={exportCsv}><i className="bi bi-download me-1" />Export CSV</Button>
          {hasPermission('sales.create') && (
            <Link to="/sales/new" className="btn btn-primary btn-sm"><i className="bi bi-cart-plus me-1" />New Sale</Link>
          )}
        </div>
      </div>

      {toast && <Alert variant={toast.type} dismissible onClose={() => setToast(null)} className="py-2 small">{toast.msg}</Alert>}

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control size="sm" placeholder="Search invoice # or customer..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 230 }} />
          <Form.Select size="sm" value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1) }} style={{ maxWidth: 150 }}>
            {['ALL', 'CASH', 'MOMO', 'BANK', 'LOAN', 'CREDIT', 'MIXED'].map((m) => <option key={m} value={m}>{m === 'ALL' ? 'All Methods' : m}</option>)}
          </Form.Select>
          <Form.Select size="sm" value={saleType} onChange={(e) => { setSaleType(e.target.value); setPage(1) }} style={{ maxWidth: 150 }}>
            {['ALL', 'NORMAL', 'ORDER', 'ON_DEMAND'].map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Types' : s.replace(/_/g, ' ')}</option>)}
          </Form.Select>
          <Form.Select size="sm" value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1) }} style={{ maxWidth: 160 }}>
            {['ALL', 'PAID', 'PARTIALLY_PAID', 'UNPAID'].map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'saleNumber', label: 'Invoice #', render: (s) => (
              <Link to={`/sales/${s._id}`} className="fw-semibold text-decoration-none" style={{ color: '#0d3b66' }}>{s.saleNumber}</Link>
            )},
            { key: 'createdAt', label: 'Date', render: (s) => <span className="small">{new Date(s.createdAt).toLocaleString()}</span> },
            { key: 'customer', label: 'Customer', render: (s) => (
              <span className="small">{s.customer?.name}<br /><small className="text-muted">{s.customer?.phone}</small></span>
            )},
            { key: 'saleType', label: 'Type', render: (s) => (s.saleType && s.saleType !== 'NORMAL' ? <StatusBadge value={s.saleType} /> : <span className="text-muted small">—</span>) },
            { key: 'total', label: 'Total', render: (s) => `${Number(s.total).toLocaleString()} RWF` },
            { key: 'profit', label: 'Profit', render: (s) => (
              <span className={`small ${(s.totalProfit ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                {(s.totalProfit ?? 0) >= 0 ? '+' : ''}{Number(s.totalProfit ?? 0).toLocaleString()}
              </span>
            )},
            { key: 'amountPaid', label: 'Paid', render: (s) => `${Number(s.amountPaid).toLocaleString()}` },
            { key: 'balance', label: 'Balance', render: (s) => (
              <span className={s.balance > 0 ? 'text-danger fw-semibold' : 'text-muted'}>{Number(s.balance).toLocaleString()}</span>
            )},
            { key: 'paymentMethod', label: 'Method', render: (s) => <StatusBadge value={s.paymentMethod} /> },
            { key: 'paymentStatus', label: 'Status', render: (s) => s.status === 'CANCELLED' ? <StatusBadge value="CANCELLED" /> : <StatusBadge value={s.paymentStatus} /> },
            { key: 'attachment', label: 'Receipt', render: (s) => s.attachment ? (
              <Link to={`/sales/${s._id}`} title={s.attachment.filename} className="text-decoration-none">
                <Badge bg="" className="badge-soft-info small" title={s.attachment.filename}>
                  <i className="bi bi-paperclip me-1" />{s.attachment.mimeType?.startsWith('image') ? 'Img' : 'PDF'}
                </Badge>
              </Link>
            ) : <span className="text-muted small">—</span> },
            { key: 'cashier', label: 'Cashier', render: (s) => <span className="small">{s.cashier?.fullName}</span> },
            { key: 'actions', label: '', render: (s) => (
              <div className="d-flex gap-1">
                <Link to={`/sales/${s._id}`} className="btn btn-sm btn-light border"><i className="bi bi-eye" /></Link>
                {hasPermission('sales.delete') && s.saleType !== 'ORDER' && s.saleType !== 'ON_DEMAND' && (
                  <Button size="sm" variant="light" className="border text-danger" onClick={() => setDeletingSale(s)}>
                    <i className="bi bi-trash" />
                  </Button>
                )}
              </div>
            )}
          ]}
          data={sales}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      <ConfirmDialog
        show={Boolean(deletingSale)}
        title="Permanently Delete Sale"
        message={`Delete sale ${deletingSale?.saleNumber || ''} (${Number(deletingSale?.total || 0).toLocaleString()} RWF)? Stock will be restored, its payments and loans removed, and the customer's totals reversed. This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteLoading}
        onClose={() => setDeletingSale(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
