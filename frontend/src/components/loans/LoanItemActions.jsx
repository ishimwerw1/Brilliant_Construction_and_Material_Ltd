import { useState } from 'react'
import { Modal, Alert, Table, Spinner, Row, Col, Card } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import StatusBadge from '../common/StatusBadge'
import MoreMenu from '../common/MoreMenu'
import { formatMoney } from '../../context/LanguageContext'

export default function LoanItemActions({ loan, item, itemIndex, canRepay, canRemove, onPay, onEdit, onRemove }) {
  const [showDetails, setShowDetails] = useState(false)
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const itemTotal = Number(item.totalAmount) || (Number(item.quantity) * Number(item.unitPrice)) || 0
  const outstanding = Number(item.outstandingBalance) || 0

  const openDetails = async () => {
    setDetails(null)
    setError('')
    setLoading(true)
    setShowDetails(true)
    try {
      const { data } = await api.get(`/loans/${String(loan._id)}/items/${itemIndex}`)
      setDetails(data.data)
    } catch (err) {
      setError(getError(err))
    } finally {
      setLoading(false)
    }
  }

  const items = [
    { key: 'details', icon: 'bi-eye text-primary', label: 'View Details & History', onClick: openDetails },
    canRepay && outstanding > 0 && { key: 'pay', icon: 'bi-cash-stack text-success', label: 'Record Payment', onClick: () => onPay(loan, item, itemIndex) },
    { key: 'edit', icon: 'bi-pencil text-warning', label: 'Edit Product', onClick: () => onEdit(loan, item, itemIndex) },
    canRemove && (item.status || 'ACTIVE') !== 'REMOVED'
      && { divider: true, key: 'remove', icon: 'bi-x-circle', label: 'Remove / Cancel Item', danger: true, onClick: () => onRemove(loan, item, itemIndex) }
  ].filter(Boolean)

  return (
    <>
      <MoreMenu header={item.productName} items={items} />

      <Modal show={showDetails} onHide={() => setShowDetails(false)} size="lg" centered scrollable className="loan-detail-modal">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6 fw-bold">
            {item.productName} <span className="text-muted fw-normal">— Loan {details?.loan?.loanNumber || loan.loanNumber}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4">
          {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
          {loading && (
            <div className="text-center py-4 text-muted">
              <Spinner size="sm" className="me-2" />Loading item details...
            </div>
          )}

          {details && (
            <>
              <Row className="g-2 mb-3">
                <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Qty</div><div className="fw-bold">{details.item.quantity}</div></Card></Col>
                <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Amount</div><div className="fw-bold">{formatMoney(itemTotal)}</div></Card></Col>
                <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Paid</div><div className="fw-bold text-success">{formatMoney(Number(details.item.amountPaid) || 0)}</div></Card></Col>
                <Col xs={6} md={3}><Card body className="p-2 text-center"><div className="text-muted small">Remaining</div><div className={`fw-bold ${Number(details.item.outstandingBalance) > 0 ? 'text-danger' : 'text-success'}`}>{formatMoney(Number(details.item.outstandingBalance) || 0)}</div></Card></Col>
              </Row>

              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="fw-semibold mb-0" style={{ color: '#0d3b66' }}>Payment History</h6>
                <StatusBadge value={details.item.status} />
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                <Table size="sm" hover responsive bordered className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Date</th>
                      <th className="text-end">Amount</th>
                      <th>Method</th>
                      <th>Ref</th>
                      <th>Received By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(details.payments || []).length === 0 && (
                      <tr><td colSpan={6} className="text-center text-muted py-3">No payments recorded for this product.</td></tr>
                    )}
                    {(details.payments || []).map((p) => (
                      <tr key={p._id}>
                        <td className="small fw-semibold">{p.paymentNumber}</td>
                        <td className="small">{new Date(p.createdAt).toLocaleString()}</td>
                        <td className="text-end small fw-semibold text-success">{formatMoney(p.amount)}</td>
                        <td className="small"><StatusBadge value={p.method} /></td>
                        <td className="small">{p.reference || '-'}</td>
                        <td className="small">{p.receivedBy?.fullName || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
    </>
  )
}