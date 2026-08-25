import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Row, Col, Form, Button, InputGroup, ListGroup, Badge, Alert, Modal } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import api, { getError } from '../../api/client'
import { formatMoney } from '../../context/LanguageContext'

export default function NewSale() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [showCustomerResults, setShowCustomerResults] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [amountPaidInput, setAmountPaidInput] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const searchTimer = useRef(null)

  useEffect(() => {
    api.get('/products', { params: { limit: 200, status: 'ACTIVE' } })
      .then((r) => setProducts(r.data.data.products))
      .catch((e) => setError(getError(e)))
  }, [])

  useEffect(() => {
    if (!customerQuery.trim() || customerQuery.length < 2) {
      setCustomerResults([])
      return
    }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/customers', { params: { search: customerQuery.trim(), limit: 8 } })
        setCustomerResults(data.data.customers)
        setShowCustomerResults(true)
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [customerQuery])

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products.slice(0, 12)
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').includes(q)
    ).slice(0, 12)
  }, [products, productSearch])

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice - i.discount, 0)
  const total = Math.max(0, subtotal - Number(discount || 0))
  const paidAmount = paymentMethod === 'LOAN' ? Number(amountPaidInput || 0) : total
  const balance = Math.max(0, total - paidAmount)

  const addToCart = (p) => {
    setError('')
    setCart((prev) => {
      const existing = prev.find((i) => i.product === p._id)
      if (existing) {
        if (existing.quantity + 1 > p.quantity) {
          setError(`Insufficient stock for "${p.name}". Available: ${p.quantity}`)
          return prev
        }
        return prev.map((i) => i.product === p._id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { product: p._id, productName: p.name, sku: p.sku, unit: p.unit, quantity: 1, unitPrice: p.sellingPrice, discount: 0, available: p.quantity }]
    })
  }

  const updateQty = (productId, qty) => {
    setCart((prev) => prev.map((i) => {
      if (i.product !== productId) return i
      const q = Math.max(0, Number(qty) || 0)
      if (q > i.available) setError(`Insufficient stock for "${i.productName}". Available: ${i.available}`)
      else setError('')
      return { ...i, quantity: Math.min(q, i.available) }
    }))
  }

  const submitSale = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        customer: customer?._id,
        customerName: customer ? undefined : newCustomer.name,
        customerPhone: customer ? undefined : newCustomer.phone,
        items: cart.map(({ product, quantity, unitPrice, discount }) => ({ product, quantity, unitPrice, discount })),
        discount: Number(discount || 0),
        amountPaid: paidAmount,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined
      }
      const { data } = await api.post('/sales', payload)
      setCompletedSale(data.data.sale)
      setConfirming(false)
    } catch (err) {
      setError(getError(err))
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  const resetAll = () => {
    setCompletedSale(null)
    setCart([]); setDiscount(0); setPaymentMethod('CASH'); setAmountPaidInput('')
    setPaymentReference(''); setDueDate(''); setNotes(''); setCustomer(null)
    setNewCustomer({ name: '', phone: '' }); setCustomerQuery(''); setError('')
  }

  /* ---------- Success screen ---------- */
  if (completedSale) {
    return (
      <div className="text-center py-5">
        <div className="mb-3"><i className="bi bi-check-circle-fill text-success" style={{ fontSize: '4rem' }} /></div>
        <h3 className="fw-bold" style={{ color: '#0d3b66' }}>Sale {completedSale.saleNumber} completed</h3>
        <p className="text-muted">
          Total: <strong>{formatMoney(completedSale.total)}</strong> · Paid: <strong>{formatMoney(completedSale.amountPaid)}</strong>
          {completedSale.balance > 0 && <> · Balance: <strong className="text-danger">{formatMoney(completedSale.balance)}</strong></>}
        </p>
        <div className="d-flex justify-content-center gap-2 mt-3">
          <Button variant="primary" onClick={() => navigate(`/sales/${completedSale._id}`)}>
            <i className="bi bi-receipt me-1" />View / Print Invoice
          </Button>
          <Button variant="outline-primary" onClick={resetAll}><i className="bi bi-plus-lg me-1" />Start New Sale</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-cart-plus me-2" />New Sale (POS)
      </h4>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}

      <Row className="g-3">
        {/* Left: catalog */}
        <Col lg={7}>
          <Card body className="mb-3">
            <Form.Label className="small fw-semibold">1. Customer</Form.Label>
            {customer ? (
              <div className="d-flex justify-content-between align-items-center border rounded p-2 bg-light">
                <div>
                  <strong className="small">{customer.name}</strong>
                  <span className="text-muted ms-2 small">{customer.phone}</span>
                  {customer.outstandingBalance > 0 && (
                    <Badge bg="" className="badge-soft-danger ms-2">owes {formatMoney(customer.outstandingBalance)}</Badge>
                  )}
                </div>
                <Button size="sm" variant="link" onClick={() => { setCustomer(null); setCustomerQuery('') }}>change</Button>
              </div>
            ) : (
              <div className="position-relative">
                <InputGroup>
                  <InputGroup.Text><i className="bi bi-person-search" /></InputGroup.Text>
                  <Form.Control
                    placeholder="Search customer by name or phone... or type a new customer below"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    onFocus={() => setShowCustomerResults(true)}
                    onBlur={() => setTimeout(() => setShowCustomerResults(false), 200)}
                  />
                </InputGroup>
                {showCustomerResults && customerResults.length > 0 && (
                  <ListGroup className="position-absolute w-100 shadow-sm" style={{ zIndex: 10 }}>
                    {customerResults.map((c) => (
                      <ListGroup.Item action key={c._id} onClick={() => { setCustomer(c); setCustomerQuery(c.name); setShowCustomerResults(false) }}>
                        <div className="d-flex justify-content-between small">
                          <span><i className="bi bi-person me-1" />{c.name}</span>
                          <span className="text-muted">{c.phone}</span>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </div>
            )}

            {!customer && (
              <Row className="g-2 mt-2">
                <Col md={6}>
                  <Form.Control size="sm" placeholder="New customer name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                </Col>
                <Col md={6}>
                  <Form.Control size="sm" placeholder="New customer phone (e.g. 0788123456)" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                </Col>
              </Row>
            )}
          </Card>

          <Card body>
            <Form.Label className="small fw-semibold">2. Products</Form.Label>
            <InputGroup className="mb-3">
              <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
              <Form.Control placeholder="Search by name, SKU or scan barcode..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} autoFocus />
            </InputGroup>

            <Row className="g-2" xs={2} md={3}>
              {filteredProducts.map((p) => (
                <Col key={p._id}>
                  <Card className={`pos-product-card ${p.quantity <= 0 ? 'opacity-50' : ''}`} onClick={() => p.quantity > 0 && addToCart(p)}>
                    <Card.Body className="p-2">
                      <div className="d-flex gap-2 align-items-center">
                        {p.image
                          ? <img src={p.image} alt="" className="pos-thumb" style={{ width: 48 }} />
                          : <span className="pos-thumb d-inline-flex align-items-center justify-content-center" style={{ width: 48 }}><i className="bi bi-box text-secondary" /></span>}
                        <div className="min-w-0">
                          <div className="small fw-semibold text-truncate-2">{p.name}</div>
                          <div className="text-muted" style={{ fontSize: '0.72rem' }}>{p.sku}</div>
                        </div>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mt-2">
                        <strong className="small">{formatMoney(p.sellingPrice)}</strong>
                        <Badge bg="" className={p.quantity === 0 ? 'badge-soft-danger' : p.quantity <= p.minStockLevel ? 'badge-soft-warning' : 'badge-soft-success'}>
                          {p.quantity}
                        </Badge>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
              {filteredProducts.length === 0 && <Col className="text-center text-muted py-4">No products match your search.</Col>}
            </Row>
          </Card>
        </Col>

        {/* Right: cart & checkout */}
        <Col lg={5}>
          <Card className="sticky-top" style={{ top: 76 }}>
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <span className="fw-semibold"><i className="bi bi-cart3 me-2" />Cart ({cart.length})</span>
              {cart.length > 0 && <Button variant="link" size="sm" className="p-0 text-danger text-decoration-none" onClick={() => setCart([])}>clear</Button>}
            </Card.Header>
            <Card.Body style={{ maxHeight: 300, overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <div className="text-center text-muted py-4 small"><i className="bi bi-cart-x fs-2 d-block opacity-50 mb-1" />Cart is empty. Add products from the left.</div>
              ) : cart.map((item) => (
                <div key={item.product} className="cart-line py-2">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="min-w-0 pe-2">
                      <div className="small fw-semibold text-truncate-2">{item.productName}</div>
                      <div className="text-muted" style={{ fontSize: '0.72rem' }}>{formatMoney(item.unitPrice)} × {item.quantity} = {formatMoney(item.quantity * item.unitPrice)}</div>
                    </div>
                    <button className="btn btn-sm btn-link text-danger p-0" onClick={() => setCart(cart.filter((i) => i.product !== item.product))}>
                      <i className="bi bi-x-lg small" />
                    </button>
                  </div>
                  <div className="d-flex align-items-center gap-2 mt-1">
                    <Button size="sm" variant="light" className="border py-0 px-2" onClick={() => updateQty(item.product, item.quantity - 1)}>−</Button>
                    <Form.Control size="sm" type="number" min="1" max={item.available} value={item.quantity} onChange={(e) => updateQty(item.product, e.target.value)} style={{ width: 70 }} />
                    <Button size="sm" variant="light" className="border py-0 px-2" onClick={() => updateQty(item.product, item.quantity + 1)} disabled={item.quantity >= item.available}>+</Button>
                    <small className="text-muted ms-auto">{item.available} in stock</small>
                  </div>
                </div>
              ))}
            </Card.Body>

            <Card.Footer className="bg-white">
              <div className="d-flex justify-content-between small mb-1">
                <span className="text-muted">Subtotal</span><strong>{formatMoney(subtotal)}</strong>
              </div>
              <div className="d-flex justify-content-between align-items-center small mb-2">
                <span className="text-muted">Discount (RWF)</span>
                <Form.Control size="sm" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} style={{ width: 110 }} />
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between mb-3">
                <span className="fw-bold">TOTAL</span>
                <span className="fw-bold fs-5" style={{ color: '#0d3b66' }}>{formatMoney(total)}</span>
              </div>

              <Form.Group className="mb-2">
                <Form.Label className="small fw-semibold">3. Payment Method *</Form.Label>
                <div className="d-flex gap-2 flex-wrap">
                  {[['CASH', 'bi-cash', 'Cash'], ['MOMO', 'bi-phone', 'MoMo'], ['BANK', 'bi-bank', 'Bank'], ['LOAN', 'bi-credit-card', 'Loan']].map(([val, icon, label]) => (
                    <Button key={val} size="sm" variant={paymentMethod === val ? 'primary' : 'outline-secondary'} onClick={() => { setPaymentMethod(val); setAmountPaidInput('') }}>
                      <i className={`bi ${icon} me-1`} />{label}
                    </Button>
                  ))}
                </div>
              </Form.Group>

              {(paymentMethod === 'MOMO' || paymentMethod === 'BANK') && (
                <Form.Group className="mb-2">
                  <Form.Label className="small">{paymentMethod === 'MOMO' ? 'MoMo Transaction ID *' : 'Bank Slip / Reference *'}</Form.Label>
                  <Form.Control size="sm" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder={paymentMethod === 'MOMO' ? 'e.g. 1234567.ABCD' : 'e.g. BK-889123'} />
                </Form.Group>
              )}

              {paymentMethod === 'LOAN' && (
                <>
                  <Row className="g-2 mb-2">
                    <Col sm={6}>
                      <Form.Group>
                        <Form.Label className="small">Down Payment (RWF)</Form.Label>
                        <Form.Control size="sm" type="number" min="0" max={total} value={amountPaidInput} onChange={(e) => setAmountPaidInput(e.target.value)} placeholder="0" />
                      </Form.Group>
                    </Col>
                    <Col sm={6}>
                      <Form.Group>
                        <Form.Label className="small">Due Date</Form.Label>
                        <Form.Control size="sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Alert variant="warning" className="py-2 small mb-2">
                    <i className="bi bi-exclamation-triangle me-1" />
                    Credit sale: a loan record will be created for the unpaid balance of <strong>{formatMoney(balance)}</strong>.
                  </Alert>
                </>
              )}

              <Form.Group className="mb-3">
                <Form.Control size="sm" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Form.Group>

              <Button className="w-100 py-2 fw-semibold" disabled={cart.length === 0 || saving} onClick={() => setConfirming(true)}>
                <i className="bi bi-check-circle me-1" />Complete Sale — {formatMoney(total)}
              </Button>
            </Card.Footer>
          </Card>
        </Col>
      </Row>

      {/* Confirmation modal */}
      <Modal show={confirming} onHide={() => !saving && setConfirming(false)} centered backdrop="static">
        <Modal.Header closeButton={!saving}><Modal.Title className="fs-6 fw-bold"><i className="bi bi-patch-check me-2 text-success" />Confirm Sale</Modal.Title></Modal.Header>
        <Modal.Body>
          <table className="table table-sm small mb-3">
            <tbody>
              <tr><td className="text-muted">Customer</td><td className="text-end fw-semibold">{customer ? `${customer.name} (${customer.phone})` : `${newCustomer.name || '-'} (${newCustomer.phone || '-'})`}</td></tr>
              <tr><td className="text-muted">Items</td><td className="text-end">{cart.reduce((s, i) => s + i.quantity, 0)} unit(s), {cart.length} product(s)</td></tr>
              <tr><td className="text-muted">Total</td><td className="text-end fw-bold">{formatMoney(total)}</td></tr>
              <tr><td className="text-muted">Payment Method</td><td className="text-end">{paymentMethod}</td></tr>
              <tr><td className="text-muted">Amount Paid</td><td className="text-end">{formatMoney(paidAmount)}</td></tr>
              {balance > 0 && (
                <tr className="table-warning"><td className="text-muted">Credit Balance</td><td className="text-end fw-bold text-danger">{formatMoney(balance)}</td></tr>
              )}
            </tbody>
          </table>
          <p className="small text-muted mb-0">Stock will be reduced immediately and all movements recorded.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setConfirming(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submitSale} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Processing...</> : <><i className="bi bi-check-lg me-1" />Confirm & Complete</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
