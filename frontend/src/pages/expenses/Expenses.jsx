import { useCallback, useEffect, useState } from 'react'
import { Card, Row, Col, Button, Modal, Form, Badge, Alert } from 'react-bootstrap'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import StatCard from '../../components/common/StatCard'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { formatMoney } from '../../context/LanguageContext'
import { useAuth } from '../../context/AuthContext'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const CATEGORIES = ['Transport', 'Rent', 'Food', 'Electricity', 'Water', 'Salaries', 'Maintenance', 'Airtime', 'Internet', 'Office', 'Other']
const PAYMENT_METHODS = ['CASH', 'MOMO', 'BANK']

const emptyForm = {
  title: '',
  category: '',
  amount: '',
  paymentMethod: 'CASH',
  date: new Date().toISOString().slice(0, 10),
  description: ''
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [paymentMethod, setPaymentMethod] = useState('ALL')
  const [userFilter, setUserFilter] = useState('')
  const [users, setUsers] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [summary, setSummary] = useState({ today: 0, week: 0, month: 0 })
  const [chartData, setChartData] = useState(null)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [detail, setDetail] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const { hasPermission, user } = useAuth()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (search) params.search = search
      if (category !== 'ALL') params.category = category
      if (paymentMethod !== 'ALL') params.paymentMethod = paymentMethod
      if (userFilter) params.user = userFilter
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/expenses', { params })
      setExpenses(data.data.expenses)
      setPages(data.data.pages)
      setTotal(data.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, category, paymentMethod, userFilter, from, to])

  const loadSummary = useCallback(async () => {
    try {
      const { data } = await api.get('/expenses/summary')
      setSummary(data.data)
    } catch { /* silent */ }
  }, [])

  const loadChartData = useCallback(async () => {
    try {
      const { data } = await api.get('/expenses/summary')
      const dist = data.data.byCategory || []
      const labels = dist.map((c) => c._id)
      const values = dist.map((c) => c.total)
      const colors = ['#0d3b66', '#1a6fb5', '#1e7e46', '#b7791f', '#c0392b', '#6f42c1', '#e67e22', '#2ecc71', '#9b59b6', '#34495e', '#f39c12']
      setChartData({
        labels,
        datasets: [{
          label: 'Expenses',
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: 4
        }]
      })
      setUsers((data.data.byUser || []).map((u) => ({ _id: u._id, name: u.name })))
    } catch { /* silent */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSummary(); loadChartData() }, [loadSummary, loadChartData])

  const openForm = (ex) => {
    setError('')
    setEditing(ex || null)
    setForm(ex
      ? {
          title: ex.title,
          category: ex.category,
          amount: ex.amount,
          paymentMethod: ex.paymentMethod,
          date: new Date(ex.date || ex.createdAt).toISOString().slice(0, 10),
          description: ex.description || ''
        }
      : emptyForm
    )
    setShowForm(true)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, amount: Number(form.amount) }
      if (editing) await api.put(`/expenses/${editing._id}`, payload)
      else await api.post('/expenses', payload)
      setShowForm(false)
      load()
      loadSummary()
      loadChartData()
    } catch (err) {
      setError(getError(err))
    } finally {
      setSaving(false)
    }
  }

  const doDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/expenses/${confirmDel._id}`)
      setConfirmDel(null)
      load()
      loadSummary()
      loadChartData()
    } catch (err) {
      setError(getError(err))
      setConfirmDel(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-wallet2 me-2" />Expenses <span className="text-muted fs-6">({total})</span>
        </h4>
        {hasPermission('expenses.create') && (
          <Button onClick={() => openForm(null)}><i className="bi bi-plus-lg me-1" />Add Expense</Button>
        )}
      </div>

      {error && !showForm && !confirmDel && (
        <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small mb-3">{error}</Alert>
      )}

      <Row className="g-3 mb-3">
        <Col xs={12} sm={4}>
          <StatCard icon="bi-calendar-day" label="Total Today" value={formatMoney(summary.today)} color="success" />
        </Col>
        <Col xs={12} sm={4}>
          <StatCard icon="bi-calendar-week" label="This Week" value={formatMoney(summary.thisWeek)} color="info" />
        </Col>
        <Col xs={12} sm={4}>
          <StatCard icon="bi-calendar-month" label="This Month" value={formatMoney(summary.thisMonth)} color="primary" />
        </Col>
      </Row>

      {chartData && chartData.labels.length > 0 && (
        <Card className="shadow-sm mb-3">
          <Card.Body className="p-3">
            <Card.Title className="fs-6 fw-semibold mb-2">
              <i className="bi bi-bar-chart me-2" />Expense Distribution — This Month
            </Card.Title>
            <div style={{ height: 220, position: 'relative' }}>
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'y',
                  plugins: { legend: { display: false } },
                  scales: { x: { beginAtZero: true, ticks: { callback: (v) => formatMoney(v) } } }
                }}
              />
            </div>
          </Card.Body>
        </Card>
      )}

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Select size="sm" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} style={{ maxWidth: 160 }}>
            <option value="ALL">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Form.Select>
          <Form.Select size="sm" value={paymentMethod} onChange={(e) => { setPaymentMethod(e.target.value); setPage(1) }} style={{ maxWidth: 150 }}>
            <option value="ALL">All Methods</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Form.Select>
          <Form.Select size="sm" value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1) }} style={{ maxWidth: 180 }}>
            <option value="">All Users</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'date', label: 'Date', render: (e) => <span className="small">{new Date(e.date || e.createdAt).toLocaleDateString()}</span> },
            { key: 'title', label: 'Expense', render: (e) => (
              <button className="btn btn-link text-decoration-none p-0 fw-semibold small" style={{ color: '#0d3b66' }} onClick={() => setDetail(e)}>
                {e.title}
              </button>
            )},
            { key: 'category', label: 'Category', render: (e) => <Badge bg="" className="badge-soft-primary">{e.category}</Badge> },
            { key: 'amount', label: 'Amount', render: (e) => <strong>{formatMoney(e.amount)}</strong> },
            { key: 'paymentMethod', label: 'Method', render: (e) => (
              <Badge bg="" className={`badge-soft-${e.paymentMethod === 'CASH' ? 'success' : e.paymentMethod === 'MOMO' ? 'info' : 'primary'}`}>{e.paymentMethod}</Badge>
            )},
            { key: 'createdBy', label: 'Created By', render: (e) => <span className="small">{e.createdBy?.fullName || '-'}</span> },
            { key: 'actions', label: 'Actions', render: (e) => (
              <div className="d-flex gap-1">
                <Button size="sm" variant="light" className="border" onClick={() => setDetail(e)}><i className="bi bi-eye" /></Button>
                {hasPermission('expenses.update') && (
                  <Button size="sm" variant="light" className="border" onClick={() => openForm(e)}><i className="bi bi-pencil" /></Button>
                )}
                {hasPermission('expenses.delete') && (
                  <Button size="sm" variant="outline-danger" onClick={() => setConfirmDel(e)}><i className="bi bi-trash" /></Button>
                )}
              </div>
            )}
          ]}
          data={expenses}
          loading={loading}
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Search expenses..."
        />
      </Card>

      {/* Detail Modal */}
      <Modal show={Boolean(detail)} onHide={() => setDetail(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold"><i className="bi bi-receipt me-2" />Expense Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detail && (
            <table className="table table-sm small mb-0">
              <tbody>
                <tr><td className="text-muted" style={{ width: 140 }}>Title</td><td className="fw-semibold">{detail.title}</td></tr>
                <tr><td className="text-muted">Category</td><td><Badge bg="" className="badge-soft-primary">{detail.category}</Badge></td></tr>
                <tr><td className="text-muted">Amount</td><td className="fw-bold">{formatMoney(detail.amount)}</td></tr>
                <tr><td className="text-muted">Payment Method</td><td>{detail.paymentMethod}</td></tr>
                <tr><td className="text-muted">Date</td><td>{new Date(detail.date || detail.createdAt).toLocaleDateString()}</td></tr>
                {detail.description && <tr><td className="text-muted">Description</td><td>{detail.description}</td></tr>}
                <tr><td className="text-muted">Created By</td><td>{detail.createdBy?.fullName}</td></tr>
                <tr><td className="text-muted">Created At</td><td>{new Date(detail.createdAt).toLocaleString()}</td></tr>
              </tbody>
            </table>
          )}
        </Modal.Body>
      </Modal>

      {/* Add/Edit Modal */}
      <Modal show={showForm} onHide={() => setShowForm(false)} centered backdrop="static">
        <Form onSubmit={submit}>
          <Modal.Header closeButton>
            <Modal.Title className="fs-6 fw-bold">{editing ? 'Edit Expense' : 'Add Expense'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Title *</Form.Label>
                  <Form.Control value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Fuel for delivery truck" />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Category *</Form.Label>
                  <Form.Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Amount (RWF) *</Form.Label>
                  <Form.Control type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Payment Method *</Form.Label>
                  <Form.Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} required>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Date *</Form.Label>
                  <Form.Control type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Description</Form.Label>
                  <Form.Control as="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes..." />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Created By</Form.Label>
                  <Form.Control value={user?.fullName || ''} disabled readOnly />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : 'Save'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmDialog
        show={Boolean(confirmDel)}
        onClose={() => setConfirmDel(null)}
        title="Delete Expense"
        message={`Delete expense "${confirmDel?.title}" (${formatMoney(confirmDel?.amount)}) permanently? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={doDelete}
      />
    </div>
  )
}
