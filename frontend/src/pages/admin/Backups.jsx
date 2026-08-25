import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, Row, Col, Button, Alert, Form } from 'react-bootstrap'
import api, { getError } from '../../api/client'
import DataTable from '../../components/common/DataTable'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import { useLanguage, formatMoney } from '../../context/LanguageContext'

export default function Backups() {
  const { hasPermission } = useAuth()
  const { t } = useLanguage()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/backups')
      setBackups(Array.isArray(data.data?.backups) ? data.data.backups : [])
    } catch (err) {
      setError(getError(err))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const createBackup = async () => {
    setCreating(true); setError(''); setInfo('')
    try {
      const { data } = await api.post('/backups')
      setInfo(`Backup created: ${data.data?.fileName} (${data.data?.sizeKb} KB)`)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setCreating(false)
    }
  }

  const download = (b) => {
    api.get(`/backups/${b.fileName}/download`, { responseType: 'blob' })
      .then(({ data }) => {
        const url = URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url; a.download = b.fileName; a.click()
        URL.revokeObjectURL(url)
      })
      .catch((err) => setError(getError(err)))
  }

  const doRestore = async () => {
    if (!confirm) return
    setRestoring(true); setError(''); setInfo('')
    try {
      let payload
      if (confirm.file) {
        const fd = new FormData()
        fd.append('file', confirm.file)
        payload = await api.post('/backups/restore', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        payload = await api.post('/backups/restore', { fileName: confirm.backup.fileName })
      }
      setInfo(payload.message || 'Database restored successfully.')
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setRestoring(false)
      setConfirm(null)
    }
  }

  const remove = async () => {
    if (!confirm) return
    setError(''); setInfo('')
    try {
      await api.delete(`/backups/${confirm.backup.fileName}`)
      load()
    } catch (err) {
      setError(getError(err))
    } finally {
      setConfirm(null)
    }
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h4 className="fw-bold mb-0" style={{ color: '#0d3b66' }}>
            <i className="bi bi-database me-2" />{t('backups')}
          </h4>
          <p className="text-muted small mb-0">{t('backupPage.subtitle')}</p>
        </div>
        {hasPermission('backups.create') && (
          <Button onClick={createBackup} disabled={creating}>
            <i className={`bi ${creating ? 'bi-arrow-repeat spin' : 'bi-cloud-plus'} me-2`}/>
            {creating ? t('backupPage.creating') : t('backupPage.create')}
          </Button>
        )}
      </div>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')} className="py-2 small">{error}</Alert>}
      {info && <Alert variant="success" dismissible onClose={() => setInfo('')} className="py-2 small">{info}</Alert>}

      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card body className="text-center h-100">
            <div className="fs-2 fw-bold" style={{ color: '#0d3b66' }}>{backups.length}</div>
            <div className="text-muted small">{t('backupPage.total')}</div>
          </Card>
        </Col>
        <Col md={4}>
          <Card body className="text-center h-100">
            <div className="fs-6 fw-semibold">{backups[0] ? new Date(backups[0].createdAt).toLocaleString() : '—'}</div>
            <div className="text-muted small mt-1">{t('backupPage.latest')}</div>
          </Card>
        </Col>
        <Col md={4}>
          <Card body className="text-center h-100">
            <div className="fs-6 fw-semibold">{backups.reduce((a, b) => a + b.sizeKb, 0).toLocaleString()} KB</div>
            <div className="text-muted small mt-1">{t('backupPage.totalSize')}</div>
          </Card>
        </Col>
      </Row>

      <Card body>
        <DataTable
          columns={[
            { key: 'fileName', label: t('backupPage.file'), render: (b) => <span className="fw-semibold small"><i className="bi bi-file-earmark-zip me-2 text-primary" />{b.fileName}</span> },
            { key: 'createdAt', label: t('date'), render: (b) => new Date(b.createdAt).toLocaleString() },
            { key: 'sizeKb', label: 'Size', render: (b) => `${b.sizeKb} KB` },
            {
              key: 'actions', label: '', thStyle: { width: 150 },
              render: (b) => (
                <div className="d-flex gap-1 justify-content-end">
                  <Button size="sm" variant="light" className="border" title={t('backupPage.download')} onClick={() => download(b)}><i className="bi bi-download" /></Button>
                  {hasPermission('backups.restore') && (
                    <Button size="sm" variant="outline-warning" title={t('backupPage.restore')} onClick={() => setConfirm({ type: 'restore', backup: b })}><i className="bi bi-arrow-counterclockwise" /></Button>
                  )}
                  {hasPermission('backups.delete') && (
                    <Button size="sm" variant="outline-danger" title={t('backupPage.delete')} onClick={() => setConfirm({ type: 'delete', backup: b })}><i className="bi bi-trash" /></Button>
                  )}
                </div>
              )
            }
          ]}
          data={backups}
          loading={loading}
          emptyText={t('backupPage.empty')}
        />

        {hasPermission('backups.restore') && (
          <hr />
        )}
        {hasPermission('backups.restore') && (
          <Row className="align-items-center g-2">
            <Col md={7}>
              <Form.Label className="small fw-semibold mb-0">{t('backupPage.uploadLabel')}</Form.Label>
              <Form.Control ref={fileRef} type="file" accept=".json" size="sm" />
            </Col>
            <Col md={5} className="d-flex gap-2">
              <Button variant="warning" size="sm"
                disabled={restoring || !fileRef.current?.files?.[0]}
                onClick={() => setConfirm({ type: 'restore', file: fileRef.current.files[0], backup: null })}
              >
                <i className="bi bi-upload me-1" />{restoring ? t('backupPage.restoring') : t('backupPage.uploadRestore')}
              </Button>
              <Form.Text muted className="align-self-center">{t('backupPage.uploadHint')}</Form.Text>
            </Col>
          </Row>
        )}
      </Card>

      <ConfirmDialog
        show={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.type === 'restore'
          ? t('backupPage.restoreConfirmTitle')
          : t('backupPage.deleteConfirmTitle')}
        message={
          confirm?.type === 'restore'
            ? `${t('backupPage.restoreWarning')} ${confirm?.file ? `"${confirm.file.name}"` : `"${confirm?.backup?.fileName}"`}? ${t('backupPage.irreversible')}`
            : `${t('backupPage.deleteWarning')} "${confirm?.backup?.fileName}"?`
        }
        confirmLabel={confirm?.type === 'restore' ? t('backupPage.restore') : t('backupPage.delete')}
        variant="danger"
        loading={restoring}
        onConfirm={confirm?.type === 'restore' ? doRestore : remove}
      />
    </div>
  )
}
