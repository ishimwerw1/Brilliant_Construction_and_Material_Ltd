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

  if (error) return <Card body className="text-danger m-2 m-md-3">{error}</Card>
  if (!data) {
    return (
      <div className="p-2 p-md-3">
        <div className="loading-shimmer mb-3 mb-md-4" style={{ height: 90, borderRadius: 14 }} />
        <Row className="g-2 g-md-3 mb-3 mb-md-4">
          {[...Array(4)].map((_, i) => (
            <Col key={i} xs={12} sm={6} xl={3}>
              <div className="loading-shimmer" style={{ height: 84, borderRadius: 12 }} />
            </Col>
          ))}
        </Row>
        <Row className="g-2 g-md-3">
          <Col xs={12} lg={6}>
            <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
          </Col>
          <Col xs={12} lg={6}>
            <div className="loading-shimmer" style={{ height: 300, borderRadius: 12 }} />
          </Col>
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
    <div className="p-2 p-sm-3 p-md-4">
      {/* Hero banner */}
      <div className="hero-banner mb-3 mb-md-4 p-3 p-md-4 rounded-3">
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
          <div>
            <h4 className="fw-bold mb-1 text-white fs-5 fs-md-4">
              {greeting()}, <span className="text-warning">{user?.fullName?.split(' ')[0]}</span>
            </h4>
            <p className="text-white-50 small mb-0">
              <i className="bi bi-calendar3 me-1" />{new Date().toLocaleDateString(undefined, { dateStyle: 'full' })}
            </p>
          </div>
          <div className="d-flex flex-row gap-3 gap-sm-4 text-white text-center w-100 w-sm-auto justify-content-between justify-content-sm-end pt-2 pt-sm-0 border-top border-sm-0 border-white-10">
            <div>
              <div className="fs-6 fs-md-5 fw-bold">{c.todaySalesCount}</div>
              <div className="text-white-50" style={{ fontSize: '0.68rem' }}>{t('sales').toUpperCase()}</div>
            </div>
            <div>
              <div className="fs-6 fs-md-5 fw-bold">{c.todayRevenue.toLocaleString()}</div>
              <div className="text-white-50" style={{ fontSize: '0.68rem' }}>RWF {t('today').toUpperCase()}</div>
            </div>
            <div>
              <div className="fs-6 fs-md-5 fw-bold">{c.lowStockCount + c.outOfStockCount}</div>
              <div className="text-white-50" style={{ fontSize: '0.68rem' }}>{t('lowStockAlerts').toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      {(hasPermission('sales.create') || hasPermission('products.create') || hasPermission('stock.create')) && (
        <Row className="g-2 g-md-3 mb-3 mb-md-4 stagger qa-row">
          {hasPermission('sales.create') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/sales/new" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#1e7e46' }}>
                <i className="bi bi-cart-plus" /><span>{t('newSale')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('products.create') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/products" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#0d3b66' }}>
                <i className="bi bi-plus-square-dotted" /><span>{t('products')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('stock.create') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/stock/in" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#b7791f' }}>
                <i className="bi bi-box-arrow-in-down" /><span>{t('stockIn')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('customers.create') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/customers" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#1a6fb5' }}>
                <i className="bi bi-person-plus" /><span>{t('customers')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('loans.read') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/loans" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#c0392b' }}>
                <i className="bi bi-cash-coin" /><span>{t('loans')}</span>
              </Link>
            </Col>
          )}
          {hasPermission('reports.read') && (
            <Col xs={6} sm={4} md={4} xl={2}>
              <Link to="/reports/financial" className="qa-tile text-decoration-none w-100" style={{ '--qa-color': '#6f42c1' }}>
                <i className="bi bi-graph-up-arrow" /><span>{t('reports')}</span>
              </Link>
            </Col>
          )}
        </Row>
      )}

      {/* Primary KPI Row */}
      <Row className="g-2 g-md-3 mb-3 mb-md-4 stagger">
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-box-seam" label={t('totalProducts')} value={c.totalProducts} color="primary" sub={`${c.totalStockQty.toLocaleString()} units in stock`} />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-cash-stack" label={t('todaysRevenue')} value={`${c.todayRevenue.toLocaleString()} RWF`} color="success" sub={`${c.todaySalesCount} ${t('sales').toLowerCase()}`} />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-people" label={t('totalCustomers')} value={c.totalCustomers} color="info" sub={`${c.totalSuppliers} ${t('suppliers').toLowerCase()}`} />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-cash-coin" label={t('outstandingLoans')} value={`${c.outstandingLoansTotal.toLocaleString()} RWF`} color="warning" sub={`${c.outstandingLoansCount} loans · overdue: ${c.overdueLoansAmount.toLocaleString()}`} />
        </Col>
      </Row>

      {/* Secondary KPI Row */}
      <Row className="g-2 g-md-3 mb-3 mb-md-4 stagger">
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-exclamation-triangle" label={t('lowStockProducts')} value={c.lowStockCount} color="warning" link="/stock/low" />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-x-octagon" label={t('outOfStockProducts')} value={c.outOfStockCount} color="danger" link="/stock/low" />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-clipboard-check" label={t('pendingOrders')} value={c.pendingOrders} color="info" link="/orders" />
        </Col>
        <Col xs={12} sm={6} xl={3}>
          <StatCard icon="bi-graph-up-arrow" label="This Month Revenue" value={`${c.monthRevenue.toLocaleString()} RWF`} color="primary" sub={`${c.monthSalesCount} sales`} />
        </Col>
      </Row>

      {/* Financial Overview Row */}
      <h6 className="fw-semibold mb-2 mt-1" style={{ color: '#0d3b66' }}><i className="bi bi-pie-chart-fill me-2" />Financial Overview — This Month</h6>
      <Row className="g-2 g-md-3 mb-2 mb-md-3 stagger">
        <Col xs={12} sm={6} xl={2}>
          <StatCard icon="bi-currency-dollar" label="Gross Profit" value={`${(c.monthGrossProfit ?? 0).toLocaleString()} RWF`} color="success" sub={`COGS: ${(c.monthCogs ?? 0).toLocaleString()}`} />
        </Col>
        <Col xs={12} sm={6} xl={2}>
          <StatCard icon="bi-box" label="Stock Value (Cost)" value={`${(c.stockValueCost ?? 0).toLocaleString()} RWF`} color="primary" sub={`Retail: ${(c.stockValueRetail ?? 0).toLocaleString()}`} />
        </Col>
        <Col xs={12} sm={6} xl={2}>
          <StatCard icon="bi-receipt-cutoff" label="Total Expenses" value={`${(c.monthExpenses ?? 0).toLocaleString()} RWF`} color="warning" link={hasPermission('expenses.read') ? '/expenses' : undefined} />
        </Col>
        <Col xs={12} sm={6} xl={2}>
          <StatCard icon="bi-arrow-repeat" label="Net Profit" value={`${(c.monthNetProfit ?? 0).toLocaleString()} RWF`} color={c.monthNetProfit >= 0 ? 'info' : 'danger'} sub="Gross − Expenses" />
        </Col>
        <Col xs={12} sm={6} xl={2}>
          <StatCard icon="bi-cart4" label="Total Purchases" value={`${(c.totalPurchases ?? 0).toLocaleString()} RWF`} color="primary" link={hasPermission('purchases.read') ? '/purchases' : undefined} />
        </Col>
        <Col xs={12} sm={6} xl={2}>
          <StatCard icon="bi-cash-coin" label="Supplier Debt" value={`${(c.supplierDebt ?? 0).toLocaleString()} RWF`} color="danger" sub={`${c.supplierDebtCount ?? 0} open`} link={hasPermission('supplierDebts.read') ? '/supplier-debts' : undefined} />
        </Col>
      </Row>

      {/* Today's Activity Row */}
      <h6 className="fw-semibold mb-2 mt-1" style={{ color: '#0d3b66' }}><i className="bi bi-calendar-event-fill me-2" />Today's Activity</h6>
      <Row className="g-2 g-md-3 mb-2 mb-md-3 stagger">
        <Col xs={6} sm={4} xl={2}><StatCard icon="bi-receipt" label="Sales Today" value={c.todaySalesCount} color="success" sub={`${c.todayRevenue.toLocaleString()} RWF`} /></Col>
        <Col xs={6} sm={4} xl={2}><StatCard icon="bi-clipboard-check" label="Orders Today" value={c.ordersToday ?? 0} color="info" /></Col>
        <Col xs={6} sm={4} xl={2}><StatCard icon="bi-receipt-cutoff" label="Expenses Today" value={`${(c.expensesToday ?? 0).toLocaleString()} RWF`} color="warning" sub={`${c.expenseCountToday ?? 0} item(s)`} /></Col>
        <Col xs={6} sm={4} xl={2}><StatCard icon="bi-cart4" label="Purchases Today" value={c.purchasesToday ?? 0} color="primary" /></Col>
        <Col xs={6} sm={4} xl={2}><StatCard icon="bi-person-plus" label="New Customers" value={c.newCustomersToday ?? 0} color="primary" /></Col>
        <Col xs={6} sm={4} xl={2}><StatCard icon="bi-people" label="Active Users" value={c.activeUsers ?? 0} color="secondary" /></Col>
      </Row>

      {/* Admin Panel */}
      {isAdminUser && (
        <Card className="mb-3 mb-md-4 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg,#0d3b66 0%,#1a5fa8 100%)' }}>
          <Card.Body className="p-3 p-md-4">
            <div className="d-flex align-items-center mb-3">
              <i className="bi bi-shield-lock text-white me-2 fs-5" />
              <span className="text-white fw-bold">Administration</span>
              <span className="text-white-50 small ms-2 d-none d-md-inline">— manage people, security and data</span>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {(user?.role?.name === 'Super Admin' || hasPermission('users.read')) && (
                <Button as={Link} to="/users" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-person-plus me-1" />{t('users')}</Button>
              )}
              {(user?.role?.name === 'Super Admin' || hasPermission('auditLogs.read')) && (
                <Button as={Link} to="/audit-logs" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-journal-text me-1" />{t('auditLogs')}</Button>
              )}
              {(user?.role?.name === 'Super Admin' || hasPermission('backups.read')) && (
                <Button as={Link} to="/backups" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-database me-1" />{t('backups')}</Button>
              )}
              {(user?.role?.name === 'Super Admin' || hasPermission('reports.read')) && (
                <Button as={Link} to="/reports/financial" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-printer me-1" />{t('reports')}</Button>
              )}
              {(user?.role?.name === 'Super Admin' || hasPermission('settings.manage')) && (
                <Button as={Link} to="/settings" variant="light" size="sm" className="flex-grow-1 flex-sm-grow-0"><i className="bi bi-gear me-1" />{t('settings')}</Button>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Charts Row */}
      <Row className="g-2 g-md-3 mb-3 mb-md-4">
        <Col xs={12} lg={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="fs-6 fw-semibold mb-3">{t('salesOverview')} — Last 7 days</Card.Title>
              <div style={{ height: 'clamp(220px, 30vw, 320px)', position: 'relative' }}>
                <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="p-3">
              <Card.Title className="fs-6 fw-semibold mb-3">{t('byPaymentMethod')} ({t('today')})</Card.Title>
              {(data.todayByMethod.cash + data.todayByMethod.momo + data.todayByMethod.bank + data.todayByMethod.credit) === 0 ? (
                <div className="text-center text-muted py-5"><i className="bi bi-pie-chart fs-2 d-block opacity-50" />{t('noData')}</div>
              ) : (
                <div style={{ height: 'clamp(220px, 30vw, 320px)', position: 'relative' }}>
                  <Doughnut data={methodData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tables Grid */}
      <Row className="g-2 g-md-3">
        <Col xs={12} lg={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white fw-semibold fs-6 py-3"><i className="bi bi-clock-history me-2 text-primary" />{t('recentTransactions')}</Card.Header>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle text-nowrap">
                <thead><tr><th>{t('type')}</th><th>{t('products')}</th><th>Qty</th><th>→</th><th>{t('performedBy')}</th></tr></thead>
                <tbody>
                  {data.recentTransactions.map((tx) => (
                    <tr key={tx._id}>
                      <td><Badge bg="" className={`badge-soft-${tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? 'success' : tx.type === 'SALE' ? 'info' : 'warning'}`}>{tx.type.replace(/_/g, ' ')}</Badge></td>
                      <td className="small text-truncate" style={{ maxWidth: 140 }}>{tx.productName}</td>
                      <td>{tx.quantity}</td>
                      <td className="small text-muted">{tx.previousQuantity} → <strong>{tx.newQuantity}</strong></td>
                      <td className="small text-truncate" style={{ maxWidth: 120 }}>{tx.performedBy?.fullName}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white fw-semibold fs-6 d-flex justify-content-between py-3">
              <span><i className="bi bi-cart-check me-2 text-success" />{t('recentSales')}</span>
            </Card.Header>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle text-nowrap">
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
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white fw-semibold fs-6 py-3"><i className="bi bi-exclamation-triangle me-2 text-warning" />{t('lowStockAlerts')}</Card.Header>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle text-nowrap">
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
            </div>
          </Card>
        </Col>

        <Col xs={12} lg={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Header className="bg-white fw-semibold fs-6 py-3"><i className="bi bi-cash-coin me-2 text-danger" />{t('topDebtors')}</Card.Header>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle text-nowrap">
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
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      {data.recentActivity && data.recentActivity.length > 0 && (
        <Row className="g-2 g-md-3 mt-1">
          <Col xs={12}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white fw-semibold fs-6 d-flex justify-content-between align-items-center py-3">
                <span><i className="bi bi-activity me-2 text-primary" />{t('recentActivity')}</span>
                {hasPermission('auditLogs.read') && (
                  <Link to="/audit-logs" className="btn btn-sm btn-outline-primary"><i className="bi bi-journal-text me-1" />Audit Logs</Link>
                )}
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table size="sm" hover className="mb-0 align-middle text-nowrap">
                    <thead><tr><th>{t('time')}</th><th>{t('user')}</th><th>{t('actions')}</th></tr></thead>
                    <tbody>
                      {data.recentActivity.map((a) => (
                        <tr key={a._id}>
                          <td className="small text-muted">{new Date(a.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="small">{a.userName}</td>
                          <td className="small">{a.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}