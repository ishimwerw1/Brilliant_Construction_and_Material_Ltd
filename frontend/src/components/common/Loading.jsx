import { Spinner } from 'react-bootstrap'

export default function Loading({ full = false }) {
  if (full) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <Spinner animation="border" variant="primary" />
      </div>
    )
  }
  return (
    <div className="text-center py-3">
      <Spinner size="sm" animation="border" variant="primary" className="me-2" />
      <span className="text-muted small">Loading...</span>
    </div>
  )
}
