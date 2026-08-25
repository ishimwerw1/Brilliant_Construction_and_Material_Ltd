import { Card } from 'react-bootstrap'

const BG = {
  primary: '#e8edf5', success: '#e6f7ec', danger: '#fdeaea',
  warning: '#fff6e0', info: '#e8f4fd'
}
const FG = {
  primary: '#0d3b66', success: '#1e7e46', danger: '#c0392b',
  warning: '#b7791f', info: '#1a6fb5'
}

export default function StatCard({ icon, label, value, color = 'primary', sub, className = '' }) {
  return (
    <Card className={`stat-card card-hover h-100 ${className}${color === 'danger' ? ' pulse-danger' : ''}`}>
      <Card.Body className="d-flex align-items-center gap-3 py-3">
        <div className="icon-box" style={{ background: BG[color], color: FG[color] }}>
          <i className={`bi ${icon}`} />
        </div>
        <div className="flex-grow-1 min-w-0">
          <div className="value text-truncate">{value}</div>
          <div className="label">{label}</div>
          {sub && <small className="text-muted d-block mt-1">{sub}</small>}
        </div>
      </Card.Body>
    </Card>
  )
}
