import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Form, Button, Modal, Row, Col, InputGroup, Alert, ListGroup } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import QuickAddProduct from '../../components/products/QuickAddProduct'
import { formatMoney } from '../../context/LanguageContext'

const STATUSES = ['ALL', 'PENDING', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'COMPLETED', 'CANCELLED']

export default function Orders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('ALL')
  const [error, setError] = useState('')

  // New order modal
  const [showNew, setShowNew] = useState(false)
  const [savingNew, setSavingNew] = useState(false)

  // Payment modal
  const [paying, setPaying] = useState(null)
  const [payMethod, setPayMethod] = useState('CASH')
  const [payAmount, setPayAmount] = useState('')
  const [payReference, setPayReference] = useState('')
  const [savingPay, setSavingPay] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (status !== 'ALL') params.status = status
      const { data } = await api.get('/orders', { params })
      setOrders(data.data.orders)
      setStats(data.data.stats)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const recordPayment = async () => {
    setSavingPay(true)
    setError('')
    try {
      const { data } = await api.post(`/orders/${paying._id}/pay`, {
        amount: Number(payAmount),
        method: payMethod,
        reference: payReference || undefined,
        notes: 'Order payment'
      })
      if (data.data.sale) {
        setPaying(null)
        setPayAmount(''); setPayReference('')
        load()
        navigate(`/sales/${data.data.sale._id}`)
        return
      }
      setPaying(null)
      setPayAmount(''); setPayReference('')
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSavingPay(false)
    }
  }

  const confirmOrder = async (order) => {
    try {
      await api.put(`/orders/${order._id}/status`, { status: 'CONFIRMED' })
      load()
    } catch (err) {
      alert(getError(err))
    }
  }

  const cancelOrder = async (order) => {
    const reason = window.prompt(`Reason for cancelling ${order.orderNumber}:`)
    if (!reason?.trim()) return
    try {
      await api.put(`/orders/${order._id}/cancel`, { reason: reason.trim() })
      load()
    } catch (err) {
      alert(getError(err))
    }
  }

  const openNew = () => {
    setError('')
    setShowNew(true)
  }

  const openPay = (o) => {
    setError('')
    setPaying(o)
    setPayMethod('CASH')
    setPayAmount(String(o.balance != null ? o.balance : Math.max(0, o.total - (o.amountPaid || 0))))
    setPayReference('')
  }

  const summaryCards = useMemo(() => [
    { label: 'Open Orders', value: stats ? stats.pending + stats.confirmed + stats.partiallyPaid : '-', icon: 'bi-clipboard', color: '#0d3b66' },
    { label: 'Awaiting Payment', value: stats ? stats.partiallyPaid : '-', icon: 'bi-hourglass-split', color: '#b45309' },
    { label: 'Outstanding (RWF)', value: stats ? formatMoney(stats.outstanding) : '-', icon: 'bi-cash-stack', color: '#dc2626' },
    { label: 'Completed', value: stats ? stats.completed : '-', icon: 'bi-check2-circle', color: '#15803d' }
  ], [stats])

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-clipboard-check me-2" />Orders <span className="text-muted fs-6">({total})</span>
        </h4>
        <div className="d-flex gap-2">
          <Form.Select size="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ maxWidth: 170 }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>)}
          </Form.Select>
          <Button size="sm" variant="primary" onClick={openNew}><i className="bi bi-plus-lg me-1" />New Order</Button>
        </div>
      </div>

      <Row className="g-2 mb-3">
        {summaryCards.map((c) => (
          <Col key={c.label} xs={6} md={3}>
            <Card body className="p-2 small shadow-sm">
              <div className="d-flex align-items-center gap-2">
                <i className={`bi ${c.icon} fs-5`} style={{ color: c.color }} />
                <div>
                  <div className="text-muted" style={{ fontSize: '0.72rem' }}>{c.label}</div>
                  <strong>{c.value}</strong>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}

      <Card body>
        <DataTable
          columns={[
            { key: 'orderNumber', label: 'Order #', render: (o) => <strong>{o.orderNumber}</strong> },
            { key: 'createdAt', label: 'Date', render: (o) => new Date(o.createdAt).toLocaleString() },
            { key: 'customer', label: 'Customer', render: (o) => (
              <span className="small">{o.customerName || o.customer?.name || '-'}<br /><small className="text-muted">{o.customer?.phone}</small></span>
            )},
            { key: 'items', label: 'Items', render: (o) => `${o.items.length} product(s)` },
            { key: 'total', label: 'Total', render: (o) => formatMoney(o.total) },
            { key: 'payments', label: 'Paid / Balance', render: (o) => {
              const paid = o.amountPaid || 0
              const bal = o.balance != null ? o.balance : Math.max(0, o.total - paid)
              return <span className="small">{formatMoney(paid)}<br /><small className="text-danger">{bal > 0.001 ? `due ${formatMoney(bal)}` : 'settled'}</small></span>
            }},
            { key: 'delivery', label: 'Delivery', render: (o) => o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : '-' },
            { key: 'status', label: 'Status', render: (o) => <StatusBadge value={o.status} /> },
            { key: 'actions', label: 'Actions', render: (o) => {
              if (o.status === 'CANCELLED' || o.status === 'COMPLETED') return <span className="text-muted small">—</span>
              return (
                <div className="d-flex gap-1">
                  {o.status === 'PENDING' && (
                    <Button size="sm" variant="outline-info" onClick={() => confirmOrder(o)} title="Mark as confirmed before payment"><i className="bi bi-check2 me-1" />Confirm</Button>
                  )}
                  <Button size="sm" variant="primary" onClick={() => openPay(o)}><i className="bi bi-credit-card me-1" />Record Payment</Button>
                  {o.status !== 'PAID' && (
                    <Button size="sm" variant="light" className="border text-danger" onClick={() => cancelOrder(o)}><i className="bi bi-x-lg" /></Button>
                  )}
                </div>
              )
            }}
          ]}
          data={orders}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      <NewOrderModal
        show={showNew}
        onHide={() => !savingNew && setShowNew(false)}
        saving={savingNew}
        setSaving={(v) => setSavingNew(v)}
        onCreated={() => { setShowNew(false); load() }}
      />

      {/* Record payment modal */}
      <Modal show={Boolean(paying)} onHide={() => !savingPay && setPaying(null)} centered backdrop="static">
        <Modal.Header closeButton={!savingPay}>
          <Modal.Title className="fs-6 fw-bold">Record Payment — {paying?.orderNumber}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <div className="small text-muted mb-3">
            <div>Customer: <strong>{paying?.customerName || paying?.customer?.name}</strong></div>
            <div>Total: <strong>{formatMoney(paying?.total)}</strong> · Paid: <strong>{formatMoney(paying?.amountPaid || 0)}</strong> · Balance: <strong className="text-danger">{formatMoney(paying?.balance != null ? paying.balance : (paying?.total || 0) - (paying?.amountPaid || 0))}</strong></div>
            <div className="mt-1">Paying the full balance will automatically create the sale, reduce stock and complete the order.</div>
          </div>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Amount (RWF) *</Form.Label>
            <Form.Control type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Payment Method *</Form.Label>
            <Form.Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="MOMO">MoMo</option>
              <option value="BANK">Bank</option>
            </Form.Select>
          </Form.Group>
          {(payMethod === 'MOMO' || payMethod === 'BANK') && (
            <Form.Group className="mb-2">
              <Form.Label className="small">Transaction Reference *</Form.Label>
              <Form.Control value={payReference} onChange={(e) => setPayReference(e.target.value)} />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setPaying(null)} disabled={savingPay}>Cancel</Button>
          <Button onClick={recordPayment} disabled={savingPay || !Number(payAmount)}>
            {savingPay ? <><span className="spinner-border spinner-border-sm me-1" />Processing...</> : 'Save Payment'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

/* ---------------- New Order modal ---------------- */

function NewOrderModal({ show, onHide, saving, setSaving, onCreated }) {
  const [products, setProducts] = useState([])
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customer, setCustomer] = useState(null)
  const [lines, setLines] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!show) return
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } })
      .then((r) => setProducts(r.data.data.products))
      .catch((e) => setError(getError(e)))
  }, [show])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q)
    )
  }, [products, productSearch])

  useEffect(() => {
    if (!customerQuery.trim() || customerQuery.length < 2) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/customers', { params: { search: customerQuery.trim(), limit: 8 } })
        setCustomerResults(data.data.customers)
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(t)
  }, [customerQuery])

  const totals = useMemo(() => {
    const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const cost = lines.reduce((s, l) => s + l.quantity * l.costPrice, 0)
    return { total, cost, profit: total - cost }
  }, [lines])

  const addLine = () => setLines((prev) => [...prev, { product: '', productName: '', quantity: 1, unitPrice: '', costPrice: '' }])

  const pickProduct = (idx, pid) => {
    const p = products.find((x) => x._id === pid)
    setLines((prev) => prev.map((l, i) => i === idx
      ? { ...l, product: pid, productName: p?.name || '', sku: p?.sku || '', quantity: 1, unitPrice: p?.sellingPrice || '', costPrice: Number(p?.buyingPrice) || 0 }
      : l))
  }

  const updateLine = (idx, patch) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const handleQuickCreated = (p) => {
    setProducts((prev) => [p, ...prev])
    setProductSearch('')
    setShowQuickAdd(false)
    setLines((prev) => [...prev, {
      product: p._id, productName: p.name, sku: p.sku || '', quantity: 1,
      unitPrice: p.sellingPrice || '', costPrice: Number(p.buyingPrice) || 0, discount: 0
    }])
  }

  const submit = async () => {
    if (!customer) { setError('Select a customer.'); return }
    if (lines.length === 0 || lines.some((l) => !l.product || !Number(l.quantity))) {
      setError('Add at least one product with a quantity.'); return
    }
    if (lines.some((l) => !Number.isFinite(Number(l.unitPrice)) || Number(l.unitPrice) < 0)) {
      setError('Every line needs a valid unit price.'); return
    }
    setSaving(true)
    setError('')
    try {
      await api.post('/orders', {
        customer: customer._id,
        items: lines.map(({ product, quantity, unitPrice, costPrice, discount }) => ({ product, quantity, unitPrice, costPrice: costPrice || undefined, discount: discount || 0 })),
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        notes: notes || undefined
      })
      setCustomer(null); setCustomerQuery(''); setLines([]); setProductSearch(''); setExpectedDeliveryDate(''); setNotes('')
      onCreated()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal show={show} onHide={onHide} centered backdrop="static" size="lg">
      <Modal.Header closeButton={!saving}>
        <Modal.Title className="fs-6 fw-bold"><i className="bi bi-plus-circle me-2 text-primary" />New Order</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}

        <Form.Label className="small fw-semibold">1. Customer *</Form.Label>
        {customer ? (
          <div className="d-flex justify-content-between align-items-center border rounded p-2 bg-light mb-3">
            <span className="small"><strong>{customer.name}</strong> <span className="text-muted">{customer.phone}</span></span>
            <Button size="sm" variant="link" onClick={() => { setCustomer(null); setCustomerQuery('') }}>change</Button>
          </div>
        ) : (
          <div className="position-relative mb-3">
            <InputGroup>
              <InputGroup.Text><i className="bi bi-person-search" /></InputGroup.Text>
              <Form.Control placeholder="Search customer by name or phone..." value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
            </InputGroup>
            {customerResults.length > 0 && (
              <ListGroup className="position-absolute w-100 shadow-sm" style={{ zIndex: 10 }}>
                {customerResults.map((c) => (
                  <ListGroup.Item action key={c._id} onClick={() => { setCustomer(c); setCustomerQuery(c.name); setCustomerResults([]) }}>
                    <span className="small"><i className="bi bi-person me-1" />{c.name}</span>
                    <span className="text-muted ms-2 small">{c.phone}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>
        )}

        <Form.Label className="small fw-semibold">2. Products (you can adjust prices/costs per line)</Form.Label>
        <div className="d-flex gap-2 mb-2">
          <InputGroup size="sm">
            <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
            <Form.Control placeholder="Search products by name, SKU or barcode..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
          </InputGroup>
          <Button size="sm" variant="outline-primary" className="text-nowrap flex-shrink-0" onClick={() => setShowQuickAdd(true)} title="Create a new product on the spot">
            <i className="bi bi-plus-lg me-1" />Add Product
          </Button>
        </div>
        {lines.map((l, idx) => (
          <Row key={idx} className="g-2 mb-2 align-items-end">
            <Col sm={5}>
              <Form.Select size="sm" value={l.product} onChange={(e) => pickProduct(idx, e.target.value)}>
                <option value="">{filteredProducts.length === 0 && productSearch ? 'No products found' : 'Select product...'}</option>
                {filteredProducts.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
              </Form.Select>
            </Col>
            <Col sm={1}>
              <Form.Control size="sm" type="number" min="1" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} title="Quantity" />
            </Col>
            <Col sm={2}>
              <InputGroup size="sm">
                <InputGroup.Text style={{ fontSize: '0.7rem' }}>RWF</InputGroup.Text>
                <Form.Control size="sm" type="number" min="0" value={l.unitPrice} onChange={(e) => updateLine(idx, { unitPrice: e.target.value })} title="Unit price" />
              </InputGroup>
            </Col>
            <Col sm={2}>
              <InputGroup size="sm">
                <InputGroup.Text style={{ fontSize: '0.7rem' }}>RWF</InputGroup.Text>
                <Form.Control size="sm" type="number" min="0" value={l.costPrice} onChange={(e) => updateLine(idx, { costPrice: e.target.value })} title="Cost (profit snapshot)" />
              </InputGroup>
            </Col>
            <Col sm={2}>
              <div className="d-flex gap-1">
                <Button size="sm" variant="light" className="border" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><i className="bi bi-x-lg text-danger" /></Button>
              </div>
            </Col>
            <Col sm={12}>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>{l.productName || '—'} · Line total {formatMoney((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))} · Cost {formatMoney((Number(l.quantity) || 0) * (Number(l.costPrice) || 0))}</small>
            </Col>
          </Row>
        ))}
        <Button size="sm" variant="outline-primary" onClick={addLine} className="mb-3"><i className="bi bi-plus-lg me-1" />Add Product Line</Button>

        <Row className="g-2 mb-3">
          <Col sm={6}>
            <Form.Group>
              <Form.Label className="small">Expected Delivery Date</Form.Label>
              <Form.Control size="sm" type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} />
            </Form.Group>
          </Col>
          <Col sm={6}>
            <Form.Group>
              <Form.Label className="small">Notes</Form.Label>
              <Form.Control size="sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </Form.Group>
          </Col>
        </Row>

        <div className="d-flex justify-content-between small bg-light border rounded p-2">
          <span>Order total: <strong style={{ color: '#0d3b66' }}>{formatMoney(totals.total)}</strong></span>
          <span>Est. cost: {formatMoney(totals.cost)}</span>
          <span>Est. profit: <strong className={totals.profit >= 0 ? 'text-success' : 'text-danger'}>{formatMoney(totals.profit)}</strong></span>
        </div>
      </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={onHide} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Creating...</> : <><i className="bi bi-check-lg me-1" />Create Order</>}
          </Button>
        </Modal.Footer>
      </Modal>

      <QuickAddProduct
        show={showQuickAdd}
        onClose={() => !saving && setShowQuickAdd(false)}
        onCreated={handleQuickCreated}
      />
    </>
  )
}