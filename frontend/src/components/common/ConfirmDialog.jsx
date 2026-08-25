import { Button, Modal, Spinner } from 'react-bootstrap'
import { useLanguage } from '../../context/LanguageContext'

export default function ConfirmDialog({ show, title, message, confirmLabel, cancelLabel, onConfirm, onClose, loading, variant = 'danger', children }) {
  const { t } = useLanguage()
  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title className="fs-6">{title || t('areYouSure')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {message && <p className="mb-2 text-muted">{message}</p>}
        {children}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onClose} disabled={loading}>{cancelLabel || t('cancel')}</Button>
        <Button variant={variant} onClick={onConfirm} disabled={loading}>
          {loading && <Spinner size="sm" className="me-1" />}
          {confirmLabel || t('confirm')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
