import { useLanguage } from '../../context/LanguageContext'

const MAP = {
  PAID: { cls: 'badge-soft-success', key: 'paid' },
  PARTIALLY_PAID: { cls: 'badge-soft-warning', key: 'partiallyPaid' },
  UNPAID: { cls: 'badge-soft-danger', key: 'unpaid' },
  ACTIVE: { cls: 'badge-soft-info', key: 'active' },
  INACTIVE: { cls: 'badge-soft-secondary', key: 'inactive' },
  PENDING: { cls: 'badge-soft-warning', key: 'pendingOrders' },
  COMPLETED: { cls: 'badge-soft-success', key: 'paid' },
  CANCELLED: { cls: 'badge-soft-danger', key: 'cancel' },
  OVERDUE: { cls: 'badge-soft-danger', key: 'overdueLoans' },
  NORMAL: { cls: 'badge-soft-success', key: 'normal' },
  LOW_STOCK: { cls: 'badge-soft-warning', key: 'low' },
  OUT_OF_STOCK: { cls: 'badge-soft-danger', key: 'outOfStock' },
  CASH: { cls: 'badge-soft-success', key: 'cash' },
  MOMO: { cls: 'badge-soft-info', key: 'momo' },
  BANK: { cls: 'badge-soft-primary', key: 'bank' },
  LOAN: { cls: 'badge-soft-warning', key: 'loan' },
  MIXED: { cls: 'badge-soft-secondary', key: 'paymentMethod' }
}

export default function StatusBadge({ value }) {
  const { t } = useLanguage()
  const cfg = MAP[value] || { cls: 'badge-soft-secondary', key: null }
  return <span className={`badge ${cfg.cls}`}>{cfg.key ? t(cfg.key) : String(value || '').replace(/_/g, ' ')}</span>
}
