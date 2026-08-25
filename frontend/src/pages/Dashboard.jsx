import { useEffect, useState } from 'react'
import { Row, Col, Card, Table, Badge, Button } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import api from '../api/client'
import StatCard from '../components/common/StatCard'
import StatusBadge from '../components/common/StatusBadge'
import Loading from '../components/common/Loading'
import { useLanguage } from '../context/LanguageContext'
import { useAuth } from '../context/AuthContext'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

export default function Dashboard() {
  const { t } = useLanguage()
  const { user, hasPermission } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const isAdminUser = user?.role?.name === 'Super Admin' ||
    hasPermission('users.read') || hasPermission('auditLogs.read') ||
    hasPermission('backups.read') || hasPermission('settings.manage')

  useEffect(() => {
    api.get('/dashboard/overview')
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load dashboard'))
  }, [])

  if (error) return <Card body className="text-danger">{error}</Card>
  if (!data) {
    return (
      <div>
        <div className="loading-shimmer mb-3" style={{ height: 90, borderRadius: 14 }} />
        <Row className="g-3 mb-4">
          {[...Array(4)].map((_, i) => <Col key={i} xl={3} md={6}><div className="loading-shimmer" style={{ height: 84, borderRadius: 12 }} /></Col>)}
        </Row>
        <Row className="g-3">
          <Col lg={6}><div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} /></Col>
          <Col lg={6}><div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} /></Col>
        </Row>
      </div>
    )
  }

  const c = data.cards

  const trendLabels = data.salesTrend.map((d) => d._id.slice(5))
  const trendData = {
    labels: trendLabels,
    datasets: [{
      label: t('revenue'),
      data: data.salesTrend.map((d) => d.revenue),
      borderColor: '#0d3b66',
      backgroundColor: 'rgba(13,59,102,0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 3
    }]
  }

  const methodData = {
    labels: [t('cash'), t('momo'), t('bank'), t('loan')],
    datasets: [{
      data: [
        data.todayByMethod.cash || 0,
        data.todayByMethod.momo || 0,
        data.todayByMethod.bank || 0,
        data.todayByMethod.credit || 0
      ],
      backgroundColor: ['#1e7e46', '#1a6fb5', '#0d3b66', '#f9a825'],
      borderWidth: 0
    }]
  }

  return (
    <div>
      {/* Hero banner */}
      <div className="hero-banner mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <h4 className="fw-bold mb-1 text-white">
              {greeting()}, <span className="text-warning">{user?.fullName?.split(' ')[0]}</span>
            </h4>
            <p className="text-white-50 small mb-0">
              <i className="bi bi-calendar3 me-1" />{new Date().toLocaleDateString(undefined, { dateStyle: 'full' })}
            </p>
          </div>
          <div className="d-flex gap-4 text-white text-center">
            <div><div className="fs-5 fw-bold">{c.todaySalesCount}</div><div className="text-white-50" style={{ fontSize: '0.68rem' }}>{t('sales').toUpperCase()}</div></div>
            <div><div className="fs-5 fw-bold">{c.todayRevenue.toLocaleString()}</div><div className="text-white-50" style={{ fontSize: '0.68rem' }}>RWF {t('today').toUpperCase()}</div></div>
            <div><div className="fs-5 fw-bold">{c.lowStockCount + c.outOfStockCount}</div><div className="text-white-50" style={{ fontSize: '0.68rem' }}>{t('lowStockAlerts').toUpperCase()}</div></div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {(hasPermission('sales.create') || hasPermission('products.create') || hasPermission('stock.create')) && (
        <Row className="g-3 mb-4 stagger qa-row">
          {hasPermission('sales.create') && (
            <Col xs={6} md={4} xl={2}>
              <Link to="/sales/new" className="qa-tile text-decoration-none" style={{ '--qa-color': '#1e7e46' }}>
                <i className="bi bi-cart-plus" /><span>{t('newSale')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('products.create') && (
            <Col xs={6} md={4} xl={2}>
              <Link to="/products" className="qa-tile text-decoration-none" style={{ '--qa-color': '#0d3b66' }}>
                <i className="bi bi-plus-square-dotted" /><span>{t('products')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('stock.create') && (
            <Col xs={6} md={4} xl={2}>
              <Link to="/stock/in" className="qa-tile text-decoration-none" style={{ '--qa-color': '#b7791f' }}>
                <i className="bi bi-box-arrow-in-down" /><span>{t('stockIn')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('customers.create') && (
            <Col xs={6} md={4} xl={2}>
              <Link to="/customers" className="qa-tile text-decoration-none" style={{ '--qa-color': '#1a6fb5' }}>
                <i className="bi bi-person-plus" /><span>{t('customers')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('loans.read') && (
            <Col xs={6} md={4} xl={2}>
              <Link to="/loans" className="qa-tile text-decoration-none" style={{ '--qa-color': '#c0392b' }}>
                <i className="bi bi-cash-coin" /><span>{t('loans')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('reports.read') && (
            <Col xs={6} md={4} xl={2}>
              <Link to="/reports/financial" className="qa-tile text-decoration-none" style={{ '--qa-color': '#6f42c1' }}>
                <i className="bi bi-graph-up-arrow" /><span>{t('reports')}</span>
              </Link>
            </Col>
          )}
        </Row>
      )}

      <Row className="g-3 mb-4 stagger">
        <Col xl={3} md={6}><StatCard icon="bi-box-seam" label={t('totalProducts')} value={c.totalProducts} color="primary" sub={`${c.totalStockQty.toLocaleString()} units in stock`} /></Col>
        <Col xl={3} md={6}><StatCard icon="bi-cash-stack" label={t('todaysRevenue')} value={`${c.todayRevenue.toLocaleString()} RWF`} color="success" sub={`${c.todaySalesCount} ${t('sales').toLowerCase()}`} /></Col>
        <Col xl={3} md={6}><StatCard icon="bi-people" label={t('totalCustomers')} value={c.totalCustomers} color="info" sub={`${c.totalSuppliers} ${t('suppliers').toLowerCase()}`} /></Col>
        <Col xl={3} md={6}><StatCard icon="bi-cash-coin" label={t('outstandingLoans')} value={`${c.outstandingLoansTotal.toLocaleString()} RWF`} color="warning" sub={`${c.outstandingLoansCount} loans · overdue: ${c.overdueLoansAmount.toLocaleString()}`} /></Col>
      </Row>

      <Row className="g-3 mb-4 stagger">
        <Col xl={3} md={6}><StatCard icon="bi-exclamation-triangle" label={t('lowStockProducts')} value={c.lowStockCount} color="warning" link="/stock/low" /></Col>
        <Col xl={3} md={6}><StatCard icon="bi-x-octagon" label={t('outOfStockProducts')} value={c.outOfStockCount} color="danger" link="/stock/low" /></Col>
        <Col xl={3} md={6}><StatCard icon="bi-clipboard-check" label={t('pendingOrders')} value={c.pendingOrders} color="info" link="/orders" /></Col>
        <Col xl={3} md={6}><StatCard icon="bi-graph-up-arrow" label="This Month Revenue" value={`${c.monthRevenue.toLocaleString()} RWF`} color="primary" sub={`${c.monthSalesCount} sales`} /></Col>
      </Row>

      {isAdminUser && (
        <Card className="mb-4 border-0" style={{ background: 'linear-gradient(135deg,#0d3b66 0%,#1a5fa8 100%)' }}>
          <Card.Body className="py-3">
            <div className="d-flex align-items-center mb-3">
              <i className="bi bi-shield-lock text-white me-2 fs-5" />
              <span className="text-white fw-bold">Administration</span>
              <span className="text-white-50 small ms-2 d-none d-md-inline">— manage people, security and data</span>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {(user?.role?.name === 'Super Admin' || hasPermission('users.read')) && (
                <Button as={Link} to="/users" variant="light" size="sm"><i className="bi bi-person-plus me-1" />{t('users')}</Button>
              )}
              {(user?.role?.name === 'Super Admin' || hasPermission('auditLogs.read')) && (
                <Button as={Link} to="/audit-logs" variant="light" size="sm"><i className="bi bi-journal-text me-1" />{t('auditLogs')}</Button>
              )}
              {(user?.role?.name === 'Super Admin' || hasPermission('backups.read')) && (
                <Button as={Link} to="/backups" variant="light" size="sm"><i className="bi bi-database me-1" />{t('backups')}</Button>
              )}
              {(user?.role?.name === 'Super Admin' || hasPermission('reports.read')) && (
                <Button as={Link} to="/reports/financial" variant="light" size="sm"><i className="bi bi-printer me-1" />{t('reports')}</Button>
              )}
              {(user?.role?.name === 'Super Admin' || hasPermission('settings.manage')) && (
                <Button as={Link} to="/settings" variant="light" size="sm"><i className="bi bi-gear me-1" />{t('settings')}</Button>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      <Row className="g-3 mb-4">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="fs-6 fw-semibold">{t('salesOverview')} — Last 7 days</Card.Title>
              <div style={{ height: 'clamp(200px, 24vw, 320px)' }}>
                <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title className="fs-6 fw-semibold">{t('byPaymentMethod')} ({t('today')})</Card.Title>
              {(data.todayByMethod.cash + data.todayByMethod.momo + data.todayByMethod.bank + data.todayByMethod.credit) === 0 ? (
                <div className="text-center text-muted py-5"><i className="bi bi-pie-chart fs-2 d-block opacity-50" />{t('noData')}</div>
              ) : (
                <div style={{ height: 'clamp(200px, 24vw, 320px)' }}>
                  <Doughnut data={methodData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3">
        <Col lg={6}>
          <Card>
            <Card.Header className="bg-white fw-semibold fs-6"><i className="bi bi-clock-history me-2 text-primary" />{t('recentTransactions')}</Card.Header>
            <Table size="sm" hover className="mb-0 align-middle">
              <thead><tr><th>{t('type')}</th><th>{t('products')}</th><th>Qty</th><th>→</th><th>{t('performedBy')}</th></tr></thead>
              <tbody>
                {data.recentTransactions.map((tx) => (
                  <tr key={tx._id}>
                    <td><Badge bg="" className={`badge-soft-${tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? 'success' : tx.type === 'SALE' ? 'info' : 'warning'}`}>{tx.type.replace(/_/g, ' ')}</Badge></td>
                    <td className="small">{tx.productName}</td>
                    <td>{tx.quantity}</td>
                    <td className="small text-muted">{tx.previousQuantity} → <strong>{tx.newQuantity}</strong></td>
                    <td className="small">{tx.performedBy?.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>

        <Col lg={6}>
          <Card>
            <Card.Header className="bg-white fw-semibold fs-6 d-flex justify-content-between">
              <span><i className="bi bi-cart-check me-2 text-success" />{t('recentSales')}</span>
            </Card.Header>
            <Table size="sm" hover className="mb-0 align-middle">
              <thead><tr><th>#</th><th>{t('customers')}</th><th>{t('total')}</th><th>{t('paymentMethod')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {data.recentSales.map((s) => (
                  <tr key={s._id} className="cursor-pointer" onClick={() => (window.location.href = `/sales/${s._id}`)}>
                    <td className="small fw-semibold">{s.saleNumber}</td>
                    <td className="small">{s.customer?.name}<br /><small className="text-muted">{s.customer?.phone}</small></td>
                    <td className="small">{s.total.toLocaleString()}</td>
                    <td><StatusBadge value={s.paymentMethod} /></td>
                    <td><StatusBadge value={s.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </Col>

        <Col lg={6}>
          <Card>
            <Card.Header className="bg-white fw-semibold fs-6"><i className="bi bi-exclamation-triangle me-2 text-warning" />{t('lowStockAlerts')}</Card.Header>
            <Table size="sm" hover className="mb-0 align-middle">
              <thead><tr><th>{t('products')}</th><th>Qty</th><th>Min</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {[...data.lowStockProducts.map((p) => ({ ...p, _state: 'LOW_STOCK' })), ...data.outOfStockProducts.map((p) => ({ ...p, _state: 'OUT_OF_STOCK' }))].slice(0, 10).map((p) => (
                  <tr key={p._id}>
                    <td className="small">{p.name} <small className="text-muted">({p.sku})</small></td>
                    <td className="fw-semibold">{p.quantity}</td>
                    <td>{p.minStockLevel}</td>
                    <td><StatusBadge value={p._state} /></td>
                  </tr>
                ))}
                {data.lowStockProducts.length === 0 && data.outOfStockProducts.length === 0 && (
                  <tr><td colSpan={4} className="text-center text-muted py-3">{t('noData')}</td></tr>
                )}
              </tbody>
            </Table>
          </Card>
        </Col>

        <Col lg={6}>
          <Card>
            <Card.Header className="bg-white fw-semibold fs-6"><i className="bi bi-cash-coin me-2 text-danger" />{t('topDebtors')}</Card.Header>
            <Table size="sm" hover className="mb-0 align-middle">
              <thead><tr><th>{t('customers')}</th><th>{t('outstandingBalance')}</th><th>{t('dueDate')}</th><th>{t('status')}</th></tr></thead>
              <tbody>
                {data.topDebtors.map((l) => (
                  <tr key={l._id} className="cursor-pointer" onClick={() => (window.location.href = `/loans/${l._id}`)}>
                    <td className="small">{l.customerName}<br /><small className="text-muted">{l.customerPhone}</small></td>
                    <td className="fw-semibold text-danger">{l.outstandingBalance.toLocaleString()} RWF</td>
                    <td className="small">{l.dueDate ? new Date(l.dueDate).toLocaleDateString() : '-'}</td>
                    <td><StatusBadge value={l.status} /></td>
                  </tr>
                ))}
                {data.topDebtors.length === 0 && <tr><td colSpan={4} className="text-center text-muted py-3">{t('noData')}</td></tr>}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
