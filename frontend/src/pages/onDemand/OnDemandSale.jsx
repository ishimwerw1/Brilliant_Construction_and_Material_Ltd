import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Form, Button, Modal, InputGroup, Alert, Table, ListGroup } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import StatusBadge from '../../components/common/StatusBadge'
import { formatMoney } from '../../context/LanguageContext'

export default function OnDemandSale() {
  const [list, setList] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')

  const [showNew, setShowNew] = useState(false)
  const [paying, setPaying] = useState(null)
  const [paySide, setPaySide] = useState('customer')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')
  const [payReference, setPayReference] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 20 }
      if (status !== 'ALL') params.status = status
      const { data } = await api.get('/on-demand', { params })
      setList(data.data.transactions)
      setStats(data.data.stats)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => { load() }, [load])

  const openPay = (t, side) => {
    setError('')
    setPaying(t)
    setPaySide(side)
    setPayAmount(String(side === 'customer' ? t.balance : t.supplierBalance))
    setPayMethod('CASH')
    setPayReference('')
  }

  const submitPay = async () => {
    setSaving(true)
    setError('')
    try {
      await api.post(`/on-demand/${paying._id}/pay`, {
        side: paySide,
        amount: Number(payAmount),
        method: payMethod,
        reference: payReference || undefined
      })
      setPaying(null)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const cancelTx = async (t) => {
    const reason = window.prompt(`Reason for cancelling ${t.transactionNumber}:`)
    if (!reason?.trim()) return
    try {
      await api.put(`/on-demand/${t._id}/cancel`, { reason: reason.trim() })
      load()
    } catch (err) {
      alert(getError(err))
    }
  }

  const cards = useMemo(() => [
    { label: 'Transactions', value: stats ? stats.total : '-', icon: 'bi-arrow-left-right', color: '#0d3b66' },
    { label: 'Revenue (RWF)', value: stats ? formatMoney(stats.revenue) : '-', icon: 'bi-graph-up', color: '#15803d' },
    { label: 'Profit (RWF)', value: stats ? formatMoney(stats.profit) : '-', icon: 'bi-piggy-bank', color: '#b45309' },
    { label: 'Customer O/S', value: stats ? formatMoney(stats.outstanding) : '-', icon: 'bi-cash-stack', color: '#dc2626' },
    { label: 'Supplier O/S', value: stats ? formatMoney(stats.supplierBalance) : '-', icon: 'bi-truck', color: '#7c3aed' }
  ], [stats])

  const canOpen = (t) => ['ACTIVE', 'COMPLETED'].includes(t.status)

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-shuffle me-2" />On-Demand Sales <span className="text-muted fs-6">({total})</span>
        </h4>
        <div className="d-flex gap-2">
          <Form.Select size="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ maxWidth: 150 }}>
            {['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>)}
          </Form.Select>
          <Button size="sm" variant="primary" onClick={() => { setError(''); setShowNew(true) }}>
            <i className="bi bi-plus-lg me-1" />New On-Demand Sale
          </Button>
        </div>
      </div>

      <Row className="g-2 mb-3">
        {cards.map((c) => (
          <Col key={c.label} xs={6} md={3} lg={0} style={{ flexGrow: 1 }}>
            <Card body className="p-2 small shadow-sm h-100">
              <div className="d-flex align-items-center gap-2">
                <i className={`bi ${c.icon} fs-5`} style={{ color: c.color }} />
                <div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>{c.label}</div>
                  <strong>{c.value}</strong>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}

      <Card body className="p-0">
        <div className="table-responsive">
          <Table hover size="sm" className="align-middle bg-white mb-0">
            <thead>
              <tr>
                <th>Ref</th><th>Date</th><th>Customer</th><th>Supplier</th><th>Items</th>
                <th>Revenue</th><th>Cost</th><th>Profit</th><th>Customer Paid/Bal</th><th>Supplier O/S</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="12" className="text-center py-4 text-muted"><span className="spinner-border spinner-border-sm me-2" />Loading...</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan="12" className="text-center py-5 text-muted"><i className="bi bi-inbox d-block fs-2 opacity-50" />No on-demand transactions yet.</td></tr>
              ) : list.map((t) => (
                <tr key={t._id}>
                  <td><strong>{t.transactionNumber}</strong></td>
                  <td className="small text-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td className="small">{t.customerName || t.customer?.name}</td>
                  <td className="small text-nowrap">{t.supplierName || t.supplier?.name}</td>
                  <td className="small">{t.items.length}</td>
                  <td className="small">{formatMoney(t.totalAmount)}</td>
                  <td className="small text-muted">{formatMoney(t.totalCost)}</td>
                  <td className="small fw-semibold text-success">+{formatMoney(t.totalProfit)}</td>
                  <td className="small">
                    {formatMoney(t.amountPaid || 0)}
                    {t.balance > 0.001 && <div className="text-danger">due {formatMoney(t.balance)}</div>}
                  </td>
                  <td className="small text-danger">{t.supplierBalance > 0.001 ? formatMoney(t.supplierBalance) : 'settled'}</td>
                  <td><StatusBadge value={t.status} /></td>
                  <td>
                    {canOpen(t) && (
                      <div className="d-flex gap-1 flex-wrap">
                        {t.paymentStatus !== 'PAID' && (
                          <Button size="sm" variant="outline-success" onClick={() => openPay(t, 'customer')} title="Customer payment"><i className="bi bi-cash-coin" /></Button>
                        )}
                        {t.supplierPaymentStatus !== 'PAID' && (
                          <Button size="sm" variant="outline-secondary" onClick={() => openPay(t, 'supplier')} title="Supplier payment"><i className="bi bi-truck" /></Button>
                        )}
                        <Button size="sm" variant="light" className="border text-danger" onClick={() => cancelTx(t)} title="Cancel"><i className="bi bi-x-lg" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        {pages > 1 && (
          <div className="p-2 d-flex justify-content-between align-items-center">
            <small className="text-muted">Page {page} of {pages} · {total} records</small>
            <div className="d-flex gap-1">
              <Button size="sm" variant="light" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</Button>
              <Button size="sm" variant="light" disabled={page >= pages} onClick={() => setPage(page + 1)}>›</Button>
            </div>
          </div>
        )}
      </Card>

      <NewOnDemandModal
        show={showNew}
        onHide={() => !saving && setShowNew(false)}
        saving={saving}
        setSaving={setSaving}
        onCreated={() => { setShowNew(false); setPage(1); load() }}
      />

      {/* Pay modal */}
      <Modal show={Boolean(paying)} onHide={() => !saving && setPaying(null)} centered backdrop="static">
        <Modal.Header closeButton={!saving}>
          <Modal.Title className="fs-6 fw-bold">
            {paySide === 'customer' ? 'Customer Payment' : 'Supplier Payment'} — {paying?.transactionNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <div className="small text-muted mb-3">
            {paySide === 'customer'
              ? <>Collecting from <strong>{paying?.customerName}</strong>. Outstanding: <strong className="text-danger">{formatMoney(paying?.balance)}</strong></>
              : <>Paying <strong>{paying?.supplierName}</strong>. Supplier balance: <strong className="text-danger">{formatMoney(paying?.supplierBalance)}</strong></>}
          </div>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Amount (RWF) *</Form.Label>
            <Form.Control type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Payment Method *</Form.Label>
            <Form.Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="CASH">Cash</option><option value="MOMO">MoMo</option><option value="BANK">Bank</option>
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
          <Button variant="light" onClick={() => setPaying(null)} disabled={saving}>Cancel</Button>
          <Button onClick={submitPay} disabled={saving || !Number(payAmount)}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save Payment'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}

/* ---------------- New On-Demand Sale modal ---------------- */

function NewOnDemandModal({ show, onHide, saving, setSaving, onCreated }) {
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])

  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customer, setCustomer] = useState(null)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' })

  const [supplierId, setSupplierId] = useState('')
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '' })
  const [savingSupplier, setSavingSupplier] = useState(false)

  const [lines, setLines] = useState([])
  const [amountPaid, setAmountPaid] = useState('')
  const [supplierPaid, setSupplierPaid] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentReference, setPaymentReference] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!show) return
    api.get('/products', { params: { limit: 300, status: 'ACTIVE' } })
      .then((r) => setProducts(r.data.data.products))
      .catch((e) => setError(getError(e)))
    api.get('/suppliers', { params: { limit: 100 } })
      .then((r) => setSuppliers(r.data.data.suppliers))
      .catch((e) => setError(getError(e)))
  }, [show])

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
    const revenue = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.sellingPrice) || 0), 0)
    const cost = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.supplierCostPrice) || 0), 0)
    return { revenue, cost, profit: revenue - cost }
  }, [lines])

  const maxCustomerPaid = totals.revenue
  const maxSupplierPaid = totals.cost

  const addLine = () => setLines((prev) => [...prev, { product: '', productName: '', quantity: 1, supplierCostPrice: '', sellingPrice: '' }])

  const pickProduct = (idx, pid) => {
    const p = products.find((x) => x._id === pid)
    setLines((prev) => prev.map((l, i) => i === idx
      ? { ...l, product: pid, productName: p?.name || '', quantity: 1, supplierCostPrice: Number(p?.buyingPrice) || '', sellingPrice: p?.sellingPrice || '' }
      : l))
  }

  const updateLine = (idx, patch) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const createSupplier = async () => {
    if (!newSupplier.name.trim() || !newSupplier.phone.trim()) { setError('Supplier name and phone are required.'); return }
    setSavingSupplier(true)
    setError('')
    try {
      const { data } = await api.post('/suppliers', { name: newSupplier.name.trim(), phone: newSupplier.phone.trim() })
      const sup = data.data.supplier
      setSuppliers((prev) => [sup, ...prev])
      setSupplierId(sup._id)
      setShowQuickSupplier(false)
      setNewSupplier({ name: '', phone: '' })
    } catch (err) {
      setError(getError(err))
    } finally {
      setSavingSupplier(false)
    }
  }

  const submit = async () => {
    if (!customer && (!newCustomer.name.trim() || !newCustomer.phone.trim())) {
      setError('Select a customer or provide a new customer name + phone.'); return
    }
    if (!supplierId) { setError('Select a supplier or add a new one.'); return }
    if (lines.length === 0) { setError('Add at least one product line.'); return }
    if (lines.some((l) => !l.productName.trim() || !Number(l.quantity) || Number(l.supplierCostPrice) < 0 || Number(l.sellingPrice) < 0)) {
      setError('Every line needs a product name, quantity, supplier cost and selling price.'); return
    }
    if (Number(amountPaid || 0) > maxCustomerPaid) { setError('Customer payment cannot exceed the sale total.'); return }
    if (Number(supplierPaid || 0) > maxSupplierPaid) { setError('Supplier payment cannot exceed the purchase total.'); return }

    setSaving(true)
    setError('')
    try {
      await api.post('/on-demand', {
        customerId: customer?._id,
        customerName: customer ? undefined : newCustomer.name,
        customerPhone: customer ? undefined : newCustomer.phone,
        supplierId,
        items: lines.map(({ product, productName, quantity, supplierCostPrice, sellingPrice }) => ({
          product: product || undefined,
          productName,
          quantity,
          supplierCostPrice,
          sellingPrice
        })),
        amountPaid: Number(amountPaid || 0),
        supplierPaid: Number(supplierPaid || 0),
        paymentMethod,
        paymentReference: paymentReference || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined
      })
      setCustomer(null); setCustomerQuery(''); setSupplierId(''); setLines([])
      setAmountPaid(''); setSupplierPaid(''); setPaymentReference(''); setDueDate(''); setNotes('')
      onCreated()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal show={show} onHide={onHide} centered backdrop="static" size="xl">
      <Modal.Header closeButton={!saving}>
        <Modal.Title className="fs-6 fw-bold"><i className="bi bi-shuffle me-2 text-primary" />New On-Demand Sale</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}
        <div className="small text-muted mb-3">
          <i className="bi bi-info-circle me-1" />
          On-demand = products bought from a <strong>supplier</strong> directly for this <strong>customer</strong> (no stock movement).
          Profit uses the supplier's actual cost.
        </div>

        <Row className="g-3">
          <Col md={6}>
            <Form.Label className="small fw-semibold">1. Customer</Form.Label>
            {customer ? (
              <div className="d-flex justify-content-between align-items-center border rounded p-2 bg-light mb-2">
                <span className="small"><strong>{customer.name}</strong> <span className="text-muted">{customer.phone}</span></span>
                <Button size="sm" variant="link" onClick={() => { setCustomer(null); setCustomerQuery('') }}>change</Button>
              </div>
            ) : (
              <div className="position-relative mb-2">
                <InputGroup>
                  <InputGroup.Text><i className="bi bi-person-search" /></InputGroup.Text>
                  <Form.Control placeholder="Search existing customer..." value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
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
            {!customer && (
              <Row className="g-2">
                <Col xs={7}><Form.Control size="sm" placeholder="New customer name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} /></Col>
                <Col xs={5}><Form.Control size="sm" placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} /></Col>
              </Row>
            )}
          </Col>

          <Col md={6}>
            <Form.Label className="small fw-semibold">2. Supplier *</Form.Label>
            <div className="d-flex gap-1">
              <Form.Select size="sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">Select supplier...</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name} {s.companyName ? `(${s.companyName})` : ''}</option>)}
              </Form.Select>
              <Button size="sm" variant="outline-primary" className="text-nowrap" onClick={() => { setError(''); setShowQuickSupplier(true) }}>
                <i className="bi bi-plus-lg" /> Add New
              </Button>
            </div>
          </Col>
        </Row>

        <Form.Label className="small fw-semibold mt-3">3. Products</Form.Label>
        {lines.map((l, idx) => (
          <Row key={idx} className="g-2 mb-2 align-items-center">
            <Col md={4}>
              <Form.Select size="sm" value={l.product} onChange={(e) => pickProduct(idx, e.target.value)}>
                <option value="">Pick from catalogue or type below...</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Control size="sm" placeholder="Product name*" value={l.productName} onChange={(e) => updateLine(idx, { productName: e.target.value })} />
            </Col>
            <Col md={1}>
              <Form.Control size="sm" type="number" min="1" value={l.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} title="Qty" />
            </Col>
            <Col md={2}>
              <InputGroup size="sm">
                <InputGroup.Text style={{ fontSize: '0.7rem' }}>RWF</InputGroup.Text>
                <Form.Control size="sm" type="number" min="0" value={l.supplierCostPrice} onChange={(e) => updateLine(idx, { supplierCostPrice: e.target.value })} title="Supplier cost" />
              </InputGroup>
            </Col>
            <Col md={2}>
              <InputGroup size="sm">
                <InputGroup.Text style={{ fontSize: '0.7rem' }}>RWF</InputGroup.Text>
                <Form.Control size="sm" type="number" min="0" value={l.sellingPrice} onChange={(e) => updateLine(idx, { sellingPrice: e.target.value })} title="Selling price" />
              </InputGroup>
            </Col>
            <Col md={1}>
              <Button size="sm" variant="light" className="border" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><i className="bi bi-x-lg text-danger" /></Button>
            </Col>
          </Row>
        ))}
        <Button size="sm" variant="outline-primary" onClick={addLine} className="mb-3"><i className="bi bi-plus-lg me-1" />Add Product</Button>

        <Row className="g-2 align-items-end mb-3">
          <Col md={3}>
            <Form.Label className="small">Customer Pays Now (RWF)</Form.Label>
            <Form.Control size="sm" type="number" min="0" max={maxCustomerPaid} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
          </Col>
          <Col md={3}>
            <Form.Label className="small">Supplier Paid Now (RWF)</Form.Label>
            <Form.Control size="sm" type="number" min="0" max={maxSupplierPaid} value={supplierPaid} onChange={(e) => setSupplierPaid(e.target.value)} />
          </Col>
          <Col md={3}>
            <Form.Label className="small">Payment Method</Form.Label>
            <Form.Select size="sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="CASH">Cash</option><option value="MOMO">MoMo</option><option value="BANK">Bank</option>
              <option value="CREDIT">Credit (customer pays later)</option>
            </Form.Select>
          </Col>
          <Col md={3}>
            <Form.Label className="small">Due Date (credit)</Form.Label>
            <Form.Control size="sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Col>
        </Row>

        <Row className="g-2 mb-2">
          <Col md={6}>
            <Form.Control size="sm" placeholder="Reference (e.g. MoMo ID / slip)" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
          </Col>
          <Col md={6}>
            <Form.Control size="sm" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Col>
        </Row>

        <div className="d-flex justify-content-between small bg-light border rounded p-2">
          <span>Revenue: <strong style={{ color: '#0d3b66' }}>{formatMoney(totals.revenue)}</strong> · Cost: {formatMoney(totals.cost)}</span>
          <span>Profit: <strong className={totals.profit >= 0 ? 'text-success' : 'text-danger'}>{formatMoney(totals.profit)}</strong></span>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="bi bi-check-lg me-1" />Save On-Demand Sale</>}
        </Button>
      </Modal.Footer>

      {/* Quick supplier add */}
      <Modal show={showQuickSupplier} onHide={() => !savingSupplier && setShowQuickSupplier(false)} centered size="sm">
        <Modal.Header closeButton={!savingSupplier}><Modal.Title className="fs-6 fw-bold">Add Supplier</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          <Form.Group className="mb-2">
            <Form.Label className="small">Name *</Form.Label>
            <Form.Control size="sm" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small">Phone *</Form.Label>
            <Form.Control size="sm" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" size="sm" onClick={() => setShowQuickSupplier(false)} disabled={savingSupplier}>Cancel</Button>
          <Button size="sm" onClick={createSupplier} disabled={savingSupplier}>
            {savingSupplier ? 'Saving...' : 'Add & Select'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Modal>
  )
}