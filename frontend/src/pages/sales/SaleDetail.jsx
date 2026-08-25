import { useEffect, useState } from 'react'
import { Card, Button, Alert, Form } from 'react-bootstrap'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../api/client'
import StatusBadge from '../../components/common/StatusBadge'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { formatMoney } from '../../context/LanguageContext'

export default function SaleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [sale, setSale] = useState(null)
  const [company, setCompany] = useState(null)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const load = () => {
    api.get(`/sales/${id}`).then((r) => {
      setSale(r.data.data.sale)
      setCompany(r.data.data.company)
    }).catch(() => navigate('/sales'))
  }

  useEffect(load, [id, navigate])

  if (!sale || !company) return null

  const doCancel = async () => {
    if (!cancelReason.trim()) {
      setError('A cancellation reason is required.')
      return
    }
    setCancelling(true)
    setError('')
    try {
      await api.put(`/sales/${sale._id}/cancel`, { reason: cancelReason })
      setShowCancel(false)
      load()
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to cancel sale')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 no-print flex-wrap gap-2">
        <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
          <i className="bi bi-receipt me-2" />Invoice {sale.saleNumber}
        </h4>
        <div className="d-flex gap-2">
          <Button variant="light" className="border" onClick={() => navigate('/sales')}><i className="bi bi-arrow-left me-1" />Back</Button>
          <Button variant="primary" onClick={() => window.print()}><i className="bi bi-printer me-1" />Print</Button>
          {hasPermission('sales.cancel') && sale.status === 'COMPLETED' && (
            <Button variant="outline-danger" onClick={() => { setError(''); setCancelReason(''); setShowCancel(true) }}><i className="bi bi-x-circle me-1" />Cancel Sale</Button>
          )}
        </div>
      </div>

      {error && <Alert variant="danger" className="py-2 small no-print">{error}</Alert>}

      <Card className="invoice-sheet shadow-sm">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
          <div className="d-flex gap-3">
            <img src={company.logoUrl?.startsWith('/') ? company.logoUrl : '/logo.png'} alt="" style={{ width: 64 }} />
            <div>
              <h5 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>{company.companyName}</h5>
              <small className="text-muted d-block">{company.slogan}</small>
              <small className="text-muted d-block"><i className="bi bi-geo-alt me-1" />{company.address}</small>
              <small className="text-muted d-block"><i className="bi bi-telephone me-1" />{company.phone} · {company.email}</small>
            </div>
          </div>
          <div className="text-end">
            <h4 className="fw-bold mb-0">INVOICE</h4>
            <div className="small"><strong>{sale.saleNumber}</strong></div>
            <div className="small text-muted">{new Date(sale.createdAt).toLocaleString()}</div>
            <div className="mt-2"><StatusBadge value={sale.status === 'CANCELLED' ? 'CANCELLED' : sale.paymentStatus} /></div>
          </div>
        </div>

        {/* Customer + meta */}
        <div className="row mb-4">
          <div className="col-6">
            <strong className="small text-uppercase text-muted d-block mb-1">Bill To</strong>
            <div className="fw-semibold">{sale.customer?.name || sale.customerName}</div>
            <div className="small text-muted">{sale.customer?.phone}</div>
            {sale.customer?.email && <div className="small text-muted">{sale.customer.email}</div>}
            {sale.customer?.address && <div className="small text-muted">{sale.customer.address}</div>}
          </div>
          <div className="col-6 text-end">
            <div className="small"><span className="text-muted">Cashier:</span> <strong>{sale.cashier?.fullName}</strong></div>
            <div className="small"><span className="text-muted">Payment Method:</span> <StatusBadge value={sale.paymentMethod} /></div>
            {sale.paymentReference && <div className="small"><span className="text-muted">Ref:</span> {sale.paymentReference}</div>}
            {sale.notes && <div className="small text-muted mt-1 fst-italic">{sale.notes}</div>}
          </div>
        </div>

        {/* Items */}
        <table className="table table-sm table-bordered">
          <thead style={{ background: '#f8f9fb' }}>
            <tr>
              <th>#</th><th>Product</th><th>SKU</th>
              <th className="text-center">Qty</th><th className="text-end">Unit Price</th>
              <th className="text-end">Discount</th><th className="text-end">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{item.productName}</td>
                <td><code className="small">{item.sku}</code></td>
                <td className="text-center">{item.quantity}</td>
                <td className="text-end">{Number(item.unitPrice).toLocaleString()}</td>
                <td className="text-end">{item.discount ? Number(item.discount).toLocaleString() : '-'}</td>
                <td className="text-end fw-semibold">{Number(item.subtotal).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="row justify-content-end mb-4">
          <div className="col-md-5">
            <table className="table table-sm">
              <tbody>
                <tr><td>Subtotal</td><td className="text-end">{formatMoney(sale.subtotal)}</td></tr>
                {sale.discount > 0 && <tr><td>Discount</td><td className="text-end text-danger">−{formatMoney(sale.discount)}</td></tr>}
                <tr className="fs-5 fw-bold"><td>TOTAL</td><td className="text-end">{formatMoney(sale.total)}</td></tr>
                <tr><td>Amount Paid</td><td className="text-end text-success">{formatMoney(sale.amountPaid)}</td></tr>
                <tr className={sale.balance > 0 ? 'table-warning fw-bold' : ''}>
                  <td>Outstanding Balance</td>
                  <td className={`text-end ${sale.balance > 0 ? 'text-danger' : ''}`}>{formatMoney(sale.balance)}</td>
                </tr>
              </tbody>
            </table>
            {sale.paymentMethod === 'LOAN' && (
              <Alert variant="warning" className="py-2 small text-center fw-semibold mb-0">
                PAYMENT METHOD: LOAN — OUTSTANDING BALANCE: {formatMoney(sale.balance)}
              </Alert>
            )}
          </div>
        </div>

        <div className="border-top pt-3 text-center text-muted small">
          {company.invoiceFooterNote}
        </div>
      </Card>

      <ConfirmDialog
        show={showCancel}
        title="Cancel Sale"
        message={`Cancel ${sale.saleNumber}? Stock will be restored and linked loans cancelled.`}
        confirmLabel="Cancel Sale"
        loading={cancelling}
        onClose={() => setShowCancel(false)}
        onConfirm={doCancel}
      >
        {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
        <Form.Control
          as="textarea"
          rows={2}
          placeholder="Cancellation reason (required)"
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </ConfirmDialog>

      <Link to="/sales" className="btn btn-link btn-sm mt-3 ps-0 no-print">← All sales</Link>
    </div>
  )
}
