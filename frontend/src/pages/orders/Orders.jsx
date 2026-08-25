import { useCallback, useEffect, useState } from 'react'
import { Card, Form, Button, Modal } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('ALL')
  const [fulfilling, setFulfilling] = useState(null)
  const [payMethod, setPayMethod] = useState('CASH')
  const [amountPaid, setAmountPaid] = useState('')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (status !== 'ALL') params.status = status
      const { data } = await api.get('/orders', { params })
      setOrders(data.data.orders)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const fulfill = async () => {
    setSaving(true)
    setError('')
    try {
      await api.post(`/orders/${fulfilling._id}/fulfill`, {
        paymentMethod: payMethod,
        amountPaid: amountPaid === '' ? undefined : Number(amountPaid),
        paymentReference: reference || undefined
      })
      setFulfilling(null)
      setAmountPaid(''); setReference('')
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const cancelOrder = async (order) => {
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return
    try {
      await api.put(`/orders/${order._id}/cancel`)
      load()
    } catch (err) {
      alert(getError(err))
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-clipboard-check me-2" />Orders <span className="text-muted fs-6">({total})</span>
        </h4>
        <Form.Select size="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ maxWidth: 160 }}>
          {['ALL', 'PENDING', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>)}
        </Form.Select>
      </div>

      <Card body>
        <DataTable
          columns={[
            { key: 'orderNumber', label: 'Order #', render: (o) => <strong>{o.orderNumber}</strong> },
            { key: 'createdAt', label: 'Date', render: (o) => new Date(o.createdAt).toLocaleString() },
            { key: 'customer', label: 'Customer', render: (o) => (
              <span className="small">{o.customer?.name}<br /><small className="text-muted">{o.customer?.phone}</small></span>
            )},
            { key: 'items', label: 'Items', render: (o) => `${o.items.length} product(s)` },
            { key: 'total', label: 'Total', render: (o) => formatMoney(o.total) },
            { key: 'expectedDeliveryDate', label: 'Delivery', render: (o) => o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : '-' },
            { key: 'status', label: 'Status', render: (o) => <StatusBadge value={o.status} /> },
            { key: 'createdBy', label: 'By', render: (o) => o.createdBy?.fullName },
            { key: 'actions', label: 'Actions', render: (o) => (
              <div className="d-flex gap-1">
                {o.status === 'PENDING' && (
                  <>
                    <Button size="sm" variant="primary" onClick={() => setFulfilling(o)}><i className="bi bi-bag-check me-1" />Fulfill</Button>
                    <Button size="sm" variant="light" className="border text-danger" onClick={() => cancelOrder(o)}><i className="bi bi-x-lg" /></Button>
                  </>
                )}
              </div>
            )}
          ]}
          data={orders}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      <Modal show={Boolean(fulfilling)} onHide={() => !saving && setFulfilling(null)} centered backdrop="static">
        <Modal.Header closeButton={!saving}>
          <Modal.Title className="fs-6 fw-bold">Fulfill Order {fulfilling?.orderNumber}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <p className="small text-muted">
            Creates a real sale for <strong>{fulfilling?.customer?.name}</strong>, reduces stock and records payments. Total: <strong>{formatMoney(fulfilling?.total || 0)}</strong>
          </p>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Payment Method *</Form.Label>
            <Form.Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="MOMO">MoMo</option>
              <option value="BANK">Bank</option>
              <option value="LOAN">Loan / Credit</option>
            </Form.Select>
          </Form.Group>
          {(payMethod === 'MOMO' || payMethod === 'BANK') && (
            <Form.Group className="mb-2">
              <Form.Label className="small">Transaction Reference *</Form.Label>
              <Form.Control value={reference} onChange={(e) => setReference(e.target.value)} />
            </Form.Group>
          )}
          {payMethod === 'LOAN' && (
            <Form.Group>
              <Form.Label className="small">Down Payment (RWF)</Form.Label>
              <Form.Control type="number" min="0" max={fulfilling?.total} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0" />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setFulfilling(null)} disabled={saving}>Cancel</Button>
          <Button onClick={fulfill} disabled={saving}>
            {saving ? 'Processing...' : 'Create Sale'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
