import { useCallback, useEffect, useState } from 'react'
import { Card, Form, Badge } from 'react-bootstrap'
import api from '../../api/client'
import DataTable from '../../components/common/DataTable'

const actionColor = (action) => {
  if (action.includes('DELETE') || action.includes('CANCEL') || action.includes('FAILED')) return 'danger'
  if (action.includes('CREATE') || action.includes('IN') || action.includes('PAYMENT')) return 'success'
  if (action.includes('ADJUSTMENT') || action.includes('UPDATE') || action.includes('RESET')) return 'warning'
  return 'info'
}

export default function AuditLogs() {
  const [logs, setLogs] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 30 }
      if (search) params.search = search
      if (action !== 'ALL') params.action = action
      if (from) params.from = from
      if (to) params.to = to
      const { data } = await api.get('/audit-logs', { params })
      setLogs(data.data.logs)
      setPages(data.data.pages)
      setTotal(data.data.total)
      setActions(data.data.availableActions)
    } finally {
      setLoading(false)
    }
  }, [page, search, action, from, to])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h4 className="fw-bold mb-1" style={{ color: '#0d3b66' }}>
        <i className="bi bi-journal-text me-2" />Audit Logs
      </h4>
      <p className="text-muted small">Read-only record of every important action in the system.</p>

      <Card body>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Form.Control size="sm" placeholder="Search user or description..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} style={{ maxWidth: 250 }} />
          <Form.Select size="sm" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }} style={{ maxWidth: 220 }}>
            <option value="ALL">All Actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </Form.Select>
          <Form.Control size="sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
          <Form.Control size="sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} style={{ maxWidth: 155 }} />
        </div>

        <DataTable
          columns={[
            { key: 'createdAt', label: 'Date', render: (l) => new Date(l.createdAt).toLocaleString() },
            { key: 'user', label: 'User', render: (l) => <span className="small fw-semibold">{l.userName || 'System'}</span> },
            { key: 'action', label: 'Action', render: (l) => <Badge bg="" className={`badge-soft-${actionColor(l.action)}`}>{l.action}</Badge> },
            { key: 'entity', label: 'Entity', render: (l) => l.entity || '-' },
            { key: 'description', label: 'Description', render: (l) => <span className="small">{l.description}</span> }
          ]}
          data={logs}
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
