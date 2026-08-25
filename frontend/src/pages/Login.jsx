import { useState } from 'react'
import { Card, Form, Button, Alert, Spinner } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import PasswordInput from '../components/common/PasswordInput'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Login() {
  const { login } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username.trim(), form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <Card className="login-card shadow-lg border-0">
        <div className="text-center pt-4 pb-3" style={{ background: '#f8f9fb' }}>
          <img src="/logo.png" alt="logo" style={{ width: 72 }} />
          <h5 className="mt-2 mb-0 fw-bold" style={{ color: '#0d3b66' }}>{t('appName')}</h5>
          <small className="text-muted">{t('loginSubtitle')}</small>
        </div>
        <Card.Body className="p-4">
          {error && <Alert variant="danger" className="py-2 small"><i className="bi bi-exclamation-circle me-1" />{error}</Alert>}
          <Form onSubmit={submit}>
            <Form.Group className="mb-3">
              <Form.Label>{t('username')}</Form.Label>
              <Form.Control
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
                autoFocus
                required
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>{t('password')}</Form.Label>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                required
              />
            </Form.Group>
            <Button type="submit" className="w-100 py-2 fw-semibold" disabled={loading}>
              {loading ? <><Spinner size="sm" className="me-2" />{t('loggingIn')}</> : <><i className="bi bi-box-arrow-in-right me-2" />{t('signIn')}</>}
            </Button>
          </Form>

          <div className="d-flex justify-content-center mt-3">
            <Button variant="link" size="sm" className="text-decoration-none text-muted"
              onClick={() => setLang(lang === 'en' ? 'rw' : 'en')}>
              <i className="bi bi-translate me-1" />
              {lang === 'en' ? t('kinyarwanda') : t('english')}
            </Button>
          </div>
        </Card.Body>
        <Card.Footer className="text-center text-muted py-2" style={{ fontSize: '0.75rem', background: '#f8f9fb' }}>
          © {new Date().getFullYear()} Brilliant Construction and Materials Ltd
        </Card.Footer>
      </Card>
    </div>
  )
}
