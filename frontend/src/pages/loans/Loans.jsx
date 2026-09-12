import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Row, Col, Form, Badge, Button, Modal, Alert, Table, Dropdown } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatCard from '../../components/common/StatCard'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

const OPEN_STATUSES = ['ACTIVE', 'PARTIALLY_PAID', 'OVERDUE']

export default function Loans() {
  const { hasPermission } = useAuth()
  const [customers, setCustomers] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Whole-customer payment modal
  const [paying, setPaying] = useState(null)
  const [payLoans, setPayLoans] = useState([])
  const [openTotal, setOpenTotal] = useState(0)
  const [payForm, setPayForm] = useState({ amount: '', method: 'CASH', reference: '', notes: '' })
  const [savingPay, setSavingPay] = useState(false)
  const [payError, setPayError] = useState('')

  // Three-dot menu modal (all products / paid / unpaid / payment history)
  const [menuCustomer, setMenuCustomer] = useState(null)
  const [menuView, setMenuView] = useState(null) // 'ALL' | 'PAID' | 'UNPAID' | 'HISTORY'
  const [menuData, setMenuData] = useState(null)
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuError, setMenuError] = useState('')

  // Per-item payment modal (from three-dot menu)
  const [itemPayTarget, setItemPayTarget] = useState(null) // { loan, item, itemIndex }
  const [itemPayForm, setItemPayForm] = useState({ amount: '', method: 'CASH', reference: '', notes: '' })
  const [savingItemPay, setSavingItemPay] = useState(false)
  const [itemPayError, setItemPayError] = useState('')

  // Per-item return modal
  const [returnTarget, setReturnTarget] = useState(null)
  const [returnReason, setReturnReason] = useState('Product returned')
  const [savingReturn, setSavingReturn] = useState(false)

  // Per-item edit modal
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState({ quantity: '', unitPrice: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  const canRepay = hasPermission('payments.create') || hasPermission('loans.update')
  const canCancel = hasPermission('loans.cancel')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      if (status !== 'ALL') params.status = status
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/loans', { params })
      setCustomers(data.data.customers || [])
      setStats(data.data.stats)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, status, from, to])

  useEffect(() => { load() }, [load])

  // --- Whole-customer payment ---
  const startPay = async (c) => {
    setPayError('')
    try {
      const { data } = await api.get(`/loans/customer/${String(c._id)}`)
      const open = (data.data.loans || []).filter((l) => OPEN_STATUSES.includes(l.status))
      if (open.length === 0) return setPayError('This customer has no open loans to record a payment against.')
      const tot = open.reduce((s, l) => s + Number(l.outstandingBalance || 0), 0)
      setPayLoans(open)
      setOpenTotal(tot)
      setPayForm({ amount: String(tot), method: 'CASH', reference: '', notes: '' })
      setPaying(c)
    } catch (err) {
      setPayError(getError(err))
    }
  }

  const amount = Number(payForm.amount || 0)

  const preview = useMemo(() => {
    if (!payLoans.length || amount <= 0) return null
    let remaining = amount
    const rows = []
    for (const l of [...payLoans].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) {
      if (remaining <= 0.001) break
      const due = Number(l.outstandingBalance)
      const applied = Math.min(remaining, due)
      remaining = Math.max(0, remaining - applied)
      rows.push({ loan: l, applied, remainingAfter: Math.max(0, due - applied) })
    }
    return { rows, leftover: remaining }
  }, [payLoans, amount])

  const isFullyPaid = Boolean(openTotal > 0 && amount > 0 && amount >= openTotal - 0.001)

  const recordPayment = async () => {
    if (!paying) return
    if (!amount || amount <= 0) return setPayError('Enter a valid amount.')
    if (amount > openTotal) return setPayError(`Amount cannot exceed the total outstanding balance of ${formatMoney(openTotal)}.`)
    setSavingPay(true)
    setPayError('')
    try {
      const { data } = await api.post(`/loans/customer/${String(paying._id)}/pay`, {
        amount,
        method: payForm.method,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined
      })
      const paidCount = data.data.loans.length
      const rem = Number(data.data.customerOutstanding)
      setSuccessMsg(
        `Payment of ${formatMoney(amount)} recorded across ${paidCount} loan${paidCount === 1 ? '' : 's'}. ` +
        (rem > 0 ? `Remaining balance: ${formatMoney(rem)}.` : 'All loan debts are now fully paid off.')
      )
      setPaying(null)
      setPayLoans([])
      setOpenTotal(0)
      setPayForm({ amount: '', method: 'CASH', reference: '', notes: '' })
      load()
    } catch (err) {
      setPayError(getError(err))
    } finally {
      setSavingPay(false)
    }
  }

  // --- Three-dot menu: load customer data + open view ---
  const openMenuView = async (customerId, view) => {
    setMenuCustomer(null)
    setMenuView(view)
    setMenuData(null)
    setMenuError('')
    setMenuLoading(true)
    try {
      const { data } = await api.get(`/loans/customer/${customerId}`)
      setMenuCustomer(data.data)
      setMenuData(data.data)
    } catch (err) {
      setMenuError(getError(err))
    } finally {
      setMenuLoading(false)
    }
  }

  // --- Per-item payment ---
  const startItemPay = (loan, item, itemIndex) => {
    setItemPayTarget({ loan, item, itemIndex })
    setItemPayForm({
      amount: String(Number(item.outstandingBalance) || 0),
      method: 'CASH',
      reference: '',
      notes: ''
    })
    setItemPayError('')
    setMenuView(null)
  }

  const doItemPay = async () => {
    if (!itemPayTarget) return
    const amt = Number(itemPayForm.amount || 0)
    if (!amt || amt <= 0) return setItemPayError('Enter a valid amount.')
    if (amt > Number(itemPayTarget.item.outstandingBalance) + 0.001) {
      return setItemPayError(`Amount cannot exceed ${formatMoney(itemPayTarget.item.outstandingBalance)}.`)
    }
    setSavingItemPay(true)
    setItemPayError('')
    try {
      const { data } = await api.post(
        `/loans/${itemPayTarget.loan._id}/items/${itemPayTarget.itemIndex}/pay`,
        { amount: amt, method: itemPayForm.method, reference: itemPayForm.reference || undefined, notes: itemPayForm.notes || undefined }
      )
      setSuccessMsg(
        `Payment of ${formatMoney(amt)} recorded for "${itemPayTarget.item.productName}". ` +
        `Loan remaining: ${formatMoney(data.data.loan.outstandingBalance)}.`
      )
      setItemPayTarget(null)
      load()
      if (menuCustomer) openMenuView(String(menuCustomer.customer._id), menuView || 'ALL')
    } catch (err) {
      setItemPayError(getError(err))
    } finally {
      setSavingItemPay(false)
    }
  }

  // --- Per-item return ---
  const startReturn = (loan, item, itemIndex) => {
    setReturnTarget({ loan, item, itemIndex })
    setReturnReason('Product returned')
    setMenuView(null)
  }

  const doReturn = async () => {
    if (!returnTarget) return
    setSavingReturn(true)
    try {
      const { data } = await api.post(
        `/loans/${returnTarget.loan._id}/items/${returnTarget.itemIndex}/remove`,
        { reason: returnReason || 'Product returned' }
      )
      setSuccessMsg(
        `"${returnTarget.item.productName}" removed. Remaining loan debt: ${formatMoney(data.data.loan.outstandingBalance)}.`
      )
      setReturnTarget(null)
      load()
      if (menuCustomer) openMenuView(String(menuCustomer.customer._id), menuView || 'ALL')
    } catch (err) {
      alert(getError(err))
    } finally {
      setSavingReturn(false)
    }
  }

  // --- Per-item edit ---
  const startEdit = (loan, item, itemIndex) => {
    setEditTarget({ loan, item, itemIndex })
    setEditForm({ quantity: String(item.quantity), unitPrice: String(item.unitPrice) })
    setEditError('')
    setMenuView(null)
  }

  const doEdit = async () => {
    if (!editTarget) return
    const qty = Number(editForm.quantity)
    const price = Number(editForm.unitPrice)
    if (!qty || qty <= 0) return setEditError('Quantity must be at least 1.')
    if (!Number.isFinite(price) || price < 0) return setEditError('Price is invalid.')
    setSavingEdit(true)
    setEditError('')
    try {
      await api.put(
        `/loans/${editTarget.loan._id}/items/${editTarget.itemIndex}`,
        { quantity: qty, unitPrice: price }
      )
      setSuccessMsg(`"${editTarget.item.productName}" updated. New total: ${formatMoney(qty * price)}.`)
      setEditTarget(null)
      load()
      if (menuCustomer) openMenuView(String(menuCustomer.customer._id), menuView || 'ALL')
    } catch (err) {
      setEditError(getError(err))
    } finally {
      setSavingEdit(false)
    }
  }

  // Flatten all loan items for the current customer data (menu)
  const customerLoanItems = useMemo(() => {
    if (!menuData) return []
    const out = []
    ;(menuData.loans || []).forEach((loan) => {
      (loan.items || []).forEach((item, idx) => {
        if ((item.status || 'ACTIVE') === 'REMOVED') return
        const itemTotal = Number(item.totalAmount) || (Number(item.quantity) * Number(item.unitPrice))
        out.push({ loan, item, itemIndex: idx, itemTotal })
      })
    })
    return out
  }, [menuData])

  const paidItems = useMemo(() => customerLoanItems.filter((r) => r.item.status === 'PAID'), [customerLoanItems])
  const unpaidItems = useMemo(
    () => customerLoanItems.filter((r) => r.item.status !== 'PAID'),
    [customerLoanItems]
  )
  const unpaidDebt = unpaidItems.reduce((s, r) => s + Number(r.item.outstandingBalance) || 0, 0)
  const paidTotal = paidItems.reduce((s, r) => s + (Number(r.item.amountPaid) || 0), 0)

  const renderLoanItemRow = (r, showPayBtn = true) => {
    const item = r.item
    const total = Number(item.totalAmount) || (Number(item.quantity) * Number(item.unitPrice))
    return (
      <tr key={`${r.loan._id}-${r.itemIndex}`}>
        <td className="small fw-medium">{item.productName}</td>
        <td className="text-center small">{item.quantity}</td>
        <td className="text-end small">{formatMoney(total)}</td>
        <td className="text-end small">{formatMoney(Number(item.amountPaid) || 0)}</td>
        <td className="text-end small fw-semibold">{formatMoney(Number(item.outstandingBalance) || 0)}</td>
        <td className="text-center"><StatusBadge value={item.status} /></td>
        <td className="text-end">
          <div className="d-flex gap-1 justify-content-end">
            {showPayBtn && canRepay && Number(item.outstandingBalance) > 0 && (
              <Button size="sm" variant="outline-success" onClick={() => startItemPay(r.loan, item, r.itemIndex)}>
                <i className="bi bi-cash-stack" />
              </Button>
            )}
            <Button size="sm" variant="outline-primary" onClick={() => startEdit(r.loan, item, r.itemIndex)} title="Edit product">
              <i className="bi bi-pencil" />
            </Button>
            {canCancel && (
              <Button size="sm" variant="outline-danger" onClick={() => startReturn(r.loan, item, r.itemIndex)} title="Return / Remove">
                <i className="bi bi-arrow-return-left" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-cash-coin me-2" />Loans / Credit Management <span className="text-muted fs-6">({total} customer{customers.length === 1 ? '' : 's'})</span>
      </h4>

      {successMsg && <Alert variant="success" dismissible onClose={() => setSuccessMsg('')} className="py-2 small">{successMsg}</Alert>}

      {stats && (
        <Row className="g-3 mb-4">
          <Col xl={3} md={6}><StatCard icon="bi-cash-coin" label="Total Outstanding Debt" value={formatMoney(stats.totalOutstanding)} color="danger" sub={`${stats.activeCount + stats.partialCount + stats.overdueCount} open loans`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-alarm" label="Overdue Loans" value={formatMoney(stats.overdueAmount)} color="warning" sub={`${stats.overdueCount} loan(s) past due`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-arrow-up-right-circle" label="Total Credit Given" value={formatMoney(stats.totalCredit)} color="primary" sub={`${stats.totalLoans} loans total`} /></Col>
          <Col xl={3} md={6}><StatCard icon="bi-check-circle" label="Total Repaid" value={formatMoney(stats.totalRepaid)} color="success" sub={`${stats.paidCount} fully paid · ${stats.partialCount} partial`} /></Col>
        </Row>
      )}

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control size="sm" placeholder="Search customer name or phone..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 280 }} />
          <Form.Select size="sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} style={{ maxWidth: 170 }}>
            {['ALL', 'ACTIVE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
            ))}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'customerName', label: 'Customer', render: (c) => (
              <span className="small fw-semibold">{c.customerName || 'Unknown customer'}</span>
            )},
            { key: 'customerPhone', label: 'Phone', render: (c) => <code className="small">{c.customerPhone || '-'}</code> },
            { key: 'loanCount', label: 'Loans', render: (c) => <span className="small">{c.loanCount}</span> },
            { key: 'totalAmount', label: 'Total Debt', render: (c) => formatMoney(c.totalAmount) },
            { key: 'amountPaid', label: 'Paid', render: (c) => <span className="text-success fw-semibold small">{formatMoney(c.amountPaid)}</span> },
            { key: 'outstandingBalance', label: 'Remaining', render: (c) => (
              <strong className={c.outstandingBalance > 0 ? 'text-danger small' : 'text-success small'}>{formatMoney(c.outstandingBalance)}</strong>
            )},
            { key: 'actions', label: 'Action', render: (c) => (
              <div className="d-flex gap-1 align-items-center">
                <Link to={`/loans/customer/${typeof c._id === 'object' ? c._id?.toString() : c._id}`} className="btn btn-sm btn-primary" title="View loan details">
                  <i className="bi bi-eye me-1" />View
                </Link>
                {canRepay && Number(c.outstandingBalance) > 0 && (
                  <Button size="sm" variant="outline-success" onClick={() => startPay(c)} title="Record payment">
                    <i className="bi bi-cash-stack me-1" />Pay
                  </Button>
                )}
                <Dropdown align="end">
                  <Dropdown.Toggle variant="light" size="sm" className="border-0 px-1" style={{ lineHeight: 1 }}>
                    <i className="bi bi-three-dots-vertical fs-6" />
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="shadow-sm" style={{ minWidth: 220 }}>
                    <Dropdown.Header className="small fw-bold">Loan Management</Dropdown.Header>
                    <Dropdown.Item as={Link} to={`/loans/customer/${String(c._id)}`}>
                      <i className="bi bi-eye me-2 text-primary" />View Loan Details
                    </Dropdown.Item>
                    <Dropdown.Item as={Link} to={`/customers/${String(c._id)}`}>
                      <i className="bi bi-pencil me-2 text-warning" />Edit Customer
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => openMenuView(String(c._id), 'ALL')}>
                      <i className="bi bi-collection me-2 text-info" />View All Products
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => openMenuView(String(c._id), 'PAID')}>
                      <i className="bi bi-check-circle me-2 text-success" />View Paid Products
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => openMenuView(String(c._id), 'UNPAID')}>
                      <i className="bi bi-exclamation-circle me-2 text-danger" />View Unpaid Products
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={() => openMenuView(String(c._id), 'HISTORY')}>
                      <i className="bi bi-clock-history me-2 text-secondary" />Payment History
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => window.print()}>
                      <i className="bi bi-printer me-2 text-muted" />Print Loan Invoice
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            )}
          ]}
          data={customers}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {stats && stats.overdueCount > 0 && status === 'ALL' && (
        <>
          <h5 className="fw-bold mt-4 mb-2"><Badge bg="" className="badge-soft-danger">OVERDUE</Badge> Customers with Overdue Loans</h5>
          <Card body>
            {customers.filter((c) => c.outstandingBalance > 0).slice(0, 5).map((c) => (
              <div key={String(c._id)} className="d-flex justify-content-between align-items-center px-2 py-2 border-bottom">
                <div>
                  <span className="fw-semibold small">{c.customerName}</span>
                  <span className="text-muted ms-2 small"><code>{c.customerPhone}</code></span>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <strong className="text-danger">{formatMoney(c.outstandingBalance)}</strong>
                  {canRepay && <Button size="sm" variant="outline-success" onClick={() => startPay(c)}><i className="bi bi-cash-stack me-1" />Pay</Button>}
                  <Link to={`/loans/customer/${String(c._id)}`} className="btn btn-sm btn-primary">View</Link>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* =========================== Three-dot menu modal =========================== */}
      <Modal show={Boolean(menuView)} onHide={() => { setMenuView(null); setMenuCustomer(null) }} size="xl" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold" style={{ color: '#0d3b66' }}>
            {menuView === 'ALL' && <><i className="bi bi-collection me-2" />All Loan Products</>}
            {menuView === 'PAID' && <><i className="bi bi-check-circle me-2 text-success" />Paid Products</>}
            {menuView === 'UNPAID' && <><i className="bi bi-exclamation-circle me-2 text-danger" />Unpaid / Partially Paid Products</>}
            {menuView === 'HISTORY' && <><i className="bi bi-clock-history me-2" />Payment History</>}
            {menuCustomer && <span className="text-muted ms-2 fw-normal">— {menuCustomer.customer?.name || 'Customer'}</span>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4">
          {menuError && <Alert variant="danger" dismissible onClose={() => setMenuError('')} className="py-2 small">{menuError}</Alert>}

          {menuLoading && (
            <div className="text-center py-4 text-muted">
              <span className="spinner-border spinner-border-sm me-2" />Loading...
            </div>
          )}

          {!menuLoading && menuData && (
            <>
              {/* Summary bar */}
              <div className="d-flex flex-wrap gap-3 mb-3 small">
                <span>Total Products: <strong>{customerLoanItems.length}</strong></span>
                <span className="text-success">Paid: <strong>{paidItems.length}</strong> ({formatMoney(paidTotal)})</span>
                <span className="text-danger">Unpaid: <strong>{unpaidItems.length}</strong> ({formatMoney(unpaidDebt)})</span>
              </div>

              {menuView === 'ALL' && (
                <>
                  <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66' }}>All Products</h6>
                  <Table size="sm" hover responsive bordered className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-center">Qty</th>
                        <th className="text-end">Amount</th>
                        <th className="text-end">Paid</th>
                        <th className="text-end">Remaining</th>
                        <th className="text-center">Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerLoanItems.length === 0 && (
                        <tr><td colSpan={7} className="text-center text-muted py-3">No products on loan.</td></tr>
                      )}
                      {customerLoanItems.map(renderLoanItemRow)}
                    </tbody>
                  </Table>
                </>
              )}

              {menuView === 'PAID' && (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66' }}>Paid Products</h6>
                    <strong className="text-success">Total Paid: {formatMoney(paidTotal)}</strong>
                  </div>
                  <Table size="sm" hover responsive bordered className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-center">Qty</th>
                        <th className="text-end">Original Amount</th>
                        <th className="text-end">Paid</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paidItems.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-muted py-3">No fully paid products.</td></tr>
                      )}
                      {paidItems.map((r) => (
                        <tr key={`${r.loan._id}-${r.itemIndex}`}>
                          <td className="small fw-medium">{r.item.productName}</td>
                          <td className="text-center small">{r.item.quantity}</td>
                          <td className="text-end small">{formatMoney(r.itemTotal)}</td>
                          <td className="text-end small fw-bold text-success">{formatMoney(Number(r.item.amountPaid) || 0)}</td>
                          <td className="text-center"><StatusBadge value="PAID" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}

              {menuView === 'UNPAID' && (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66' }}>Unpaid Products</h6>
                    <strong className="text-danger">Remaining Debt: {formatMoney(unpaidDebt)}</strong>
                  </div>
                  <Table size="sm" hover responsive bordered className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-center">Qty</th>
                        <th className="text-end">Amount</th>
                        <th className="text-end">Paid</th>
                        <th className="text-end">Remaining</th>
                        <th className="text-center">Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidItems.length === 0 && (
                        <tr><td colSpan={7} className="text-center text-muted py-3">All products are fully paid.</td></tr>
                      )}
                      {unpaidItems.map(renderLoanItemRow)}
                    </tbody>
                  </Table>
                </>
              )}

              {menuView === 'HISTORY' && (
                <>
                  <h6 className="fw-semibold mb-2" style={{ color: '#0d3b66' }}>Payment History</h6>
                  <div style={{ maxHeight: 450, overflowY: 'auto' }}>
                    {(() => {
                      const allPayments = []
                      ;(menuData.loans || []).forEach((loan) => {
                        // payments for this customer will be in menuData.payments
                        ;(loan.items || []).forEach((item) => {
                          if ((item.status || 'ACTIVE') === 'REMOVED') return
                          allPayments.push({
                            productName: item.productName,
                            amount: Number(item.amountPaid) || 0,
                            remaining: Number(item.outstandingBalance) || 0,
                            status: item.status,
                            loanNumber: loan.loanNumber
                          })
                        })
                      })
                      return (
                        <Table size="sm" hover responsive bordered className="mb-0 align-middle">
                          <thead>
                            <tr>
                              <th>Loan #</th>
                              <th>Product</th>
                              <th className="text-end">Total</th>
                              <th className="text-end">Paid</th>
                              <th className="text-end">Remaining</th>
                              <th className="text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allPayments.length === 0 && (
                              <tr><td colSpan={6} className="text-center text-muted py-3">No payment records.</td></tr>
                            )}
                            {allPayments.map((p, i) => (
                              <tr key={i}>
                                <td className="small"><code>{p.loanNumber}</code></td>
                                <td className="small fw-medium">{p.productName}</td>
                                <td className="text-end small">{formatMoney((Number(p.amount) || 0) + p.remaining)}</td>
                                <td className="text-end small fw-semibold text-success">{formatMoney(p.amount)}</td>
                                <td className="text-end small fw-semibold text-danger">{formatMoney(p.remaining)}</td>
                                <td className="text-center"><StatusBadge value={p.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      )
                    })()}
                  </div>
                </>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* =========================== Per-item payment modal =========================== */}
      <Modal show={Boolean(itemPayTarget)} onHide={() => !savingItemPay && setItemPayTarget(null)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); doItemPay() }}>
          <Modal.Header closeButton={!savingItemPay}>
            <Modal.Title className="fs-6 fw-bold">
              Pay for "{itemPayTarget?.item?.productName}"
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {itemPayError && <Alert variant="danger" dismissible onClose={() => setItemPayError('')} className="py-2 small">{itemPayError}</Alert>}
            {itemPayTarget && (
              <Alert variant="info" className="py-2 small mb-2">
                Remaining balance: <strong>{formatMoney(Number(itemPayTarget.item.outstandingBalance) || 0)}</strong>
              </Alert>
            )}
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Amount (RWF) *</Form.Label>
              <Form.Control
                type="number" min="1"
                max={Number(itemPayTarget?.item?.outstandingBalance) || 0}
                value={itemPayForm.amount}
                onChange={(e) => setItemPayForm({ ...itemPayForm, amount: e.target.value })}
                required autoFocus
              />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Method *</Form.Label>
              <Form.Select value={itemPayForm.method} onChange={(e) => setItemPayForm({ ...itemPayForm, method: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="MOMO">MoMo</option>
                <option value="BANK">Bank</option>
              </Form.Select>
            </Form.Group>
            {(itemPayForm.method === 'MOMO' || itemPayForm.method === 'BANK') && (
              <Form.Group className="mb-2">
                <Form.Label className="small fw-semibold">Transaction Reference</Form.Label>
                <Form.Control value={itemPayForm.reference} onChange={(e) => setItemPayForm({ ...itemPayForm, reference: e.target.value })} placeholder={itemPayForm.method === 'MOMO' ? 'MoMo TXN ID' : 'Bank slip no.'} />
              </Form.Group>
            )}
            <Form.Group>
              <Form.Label className="small">Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={itemPayForm.notes} onChange={(e) => setItemPayForm({ ...itemPayForm, notes: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" disabled={savingItemPay} onClick={() => setItemPayTarget(null)}>Cancel</Button>
            <Button type="submit" variant="success" disabled={savingItemPay || !itemPayForm.amount}>
              {savingItemPay ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Record Payment'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* =========================== Per-item return confirmation =========================== */}
      <ConfirmDialog
        show={Boolean(returnTarget)}
        title={`Return "${returnTarget?.item?.productName || ''}"`}
        message={`Remove "${returnTarget?.item?.productName}" from the loan? Outstanding debt of ${formatMoney(Number(returnTarget?.item?.outstandingBalance) || 0)} will be written off.`}
        confirmLabel="Confirm Return"
        loading={savingReturn}
        onClose={() => setReturnTarget(null)}
        onConfirm={doReturn}
      >
        <Form.Group>
          <Form.Label className="small">Reason (optional)</Form.Label>
          <Form.Control as="textarea" rows={2} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
        </Form.Group>
      </ConfirmDialog>

      {/* =========================== Per-item edit modal =========================== */}
      <Modal show={Boolean(editTarget)} onHide={() => !savingEdit && setEditTarget(null)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); doEdit() }}>
          <Modal.Header closeButton={!savingEdit}>
            <Modal.Title className="fs-6 fw-bold">Edit "{editTarget?.item?.productName}"</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editError && <Alert variant="danger" dismissible onClose={() => setEditError('')} className="py-2 small">{editError}</Alert>}
            {editTarget && (
              <Alert variant="info" className="py-2 small mb-2">
                Currently paid: <strong>{formatMoney(Number(editTarget.item.amountPaid) || 0)}</strong> — only change quantity or price. Paid amount is preserved.
              </Alert>
            )}
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Quantity *</Form.Label>
              <Form.Control type="number" min="1" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} required autoFocus />
            </Form.Group>
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Unit Price (RWF) *</Form.Label>
              <Form.Control type="number" min="0" value={editForm.unitPrice} onChange={(e) => setEditForm({ ...editForm, unitPrice: e.target.value })} required />
            </Form.Group>
            <div className="small text-muted">
              New total: <strong>{formatMoney(Number(editForm.quantity || 0) * Number(editForm.unitPrice || 0))}</strong>
              {Number(editTarget?.item?.amountPaid || 0) > 0 && (
                <> — remaining after edit: <strong className="text-danger">{formatMoney(Math.max(0, Number(editForm.quantity || 0) * Number(editForm.unitPrice || 0) - Number(editTarget.item.amountPaid)))}</strong></>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" disabled={savingEdit} onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={savingEdit}>
              {savingEdit ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* =========================== Record whole-customer payment =========================== */}
      <Modal show={Boolean(paying)} onHide={() => !savingPay && setPaying(null)} centered backdrop="static">
        <Form onSubmit={(e) => { e.preventDefault(); recordPayment() }}>
          <Modal.Header closeButton={!savingPay}>
            <Modal.Title className="fs-6 fw-bold">Record Payment — {paying?.customerName}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {payError && <Alert variant="danger" dismissible onClose={() => setPayError('')} className="py-2 small">{payError}</Alert>}

            {payLoans.length > 0 && (
              <Alert variant="info" className="py-2 small">
                <i className="bi bi-collection me-1" />Total loan debt: <strong>{formatMoney(openTotal)}</strong> across {payLoans.length} open loan{payLoans.length === 1 ? '' : 's'}.
              </Alert>
            )}

            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Payment Amount (RWF) *</Form.Label>
              <Form.Control type="number" min="1" max={openTotal} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} required autoFocus />
            </Form.Group>

            {preview && (
              <div className="mb-2">
                <div className="small fw-semibold mb-1">How it will be applied (oldest loan first):</div>
                <Table size="sm" bordered className="small mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Loan #</th>
                      <th className="text-end">Balance</th>
                      <th className="text-end">Applied</th>
                      <th className="text-end">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={String(r.loan._id)}>
                        <td><code>{r.loan.loanNumber}</code></td>
                        <td className="text-end">{formatMoney(r.loan.outstandingBalance)}</td>
                        <td className="text-end text-success fw-semibold">{formatMoney(r.applied)}</td>
                        <td className="text-end">{formatMoney(r.remainingAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold">Method *</Form.Label>
              <Form.Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                <option value="CASH">Cash</option>
                <option value="MOMO">MoMo</option>
                <option value="BANK">Bank</option>
              </Form.Select>
            </Form.Group>

            {(payForm.method === 'MOMO' || payForm.method === 'BANK') && (
              <Form.Group className="mb-2">
                <Form.Label className="small">Transaction Reference (optional)</Form.Label>
                <Form.Control value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder={payForm.method === 'MOMO' ? 'MoMo TXN ID' : 'Bank slip no.'} />
              </Form.Group>
            )}

            <Form.Group className="mb-2">
              <Form.Label className="small">Notes</Form.Label>
              <Form.Control as="textarea" rows={2} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </Form.Group>

            {amount > 0 && openTotal > 0 && (
              <Alert variant={isFullyPaid ? 'success' : 'warning'} className="py-2 small mb-0">
                {isFullyPaid
                  ? <><i className="bi bi-check-circle me-1" />All loan debts will be <strong>fully paid off</strong>.</>
                  : <>After this payment the remaining total debt will be <strong>{formatMoney(Math.max(0, openTotal - amount))}</strong>.</>}
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" type="button" disabled={savingPay} onClick={() => setPaying(null)}>Cancel</Button>
            <Button type="submit" variant="success" disabled={savingPay || !amount}>
              {savingPay ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Confirm Payment'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  )
}