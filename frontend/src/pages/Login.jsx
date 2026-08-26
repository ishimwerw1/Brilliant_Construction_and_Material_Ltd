import { useState } from 'react'
import { Form, Button, Alert, Spinner } from 'react-bootstrap'
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
    <div className="login-wrapper">
      <style>{`
        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(to bottom, #3b52f6 50%, #dce5fa 50%);
          padding: 20px;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .login-card-container {
          display: flex;
          width: 100%;
          max-width: 880px;
          min-height: 480px;
          background-color: #ffffff;
          border-radius: 24px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .login-form-side {
          flex: 1;
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .login-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1a1d2e;
          margin-bottom: 24px;
        }

        .custom-label {
          font-size: 0.85rem;
          color: #8c94a0;
          margin-bottom: 6px;
        }

        .login-form-side input.form-control {
          background-color: #f1f4f9;
          border: 1px solid transparent;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 0.95rem;
          color: #2b2d42;
        }

        .login-form-side input.form-control:focus {
          background-color: #ffffff;
          box-shadow: 0 0 0 3px rgba(59, 82, 246, 0.15);
          border-color: #3b52f6;
        }

        .custom-btn {
          background-color: #3b52f6 !important;
          border: none !important;
          border-radius: 12px !important;
          padding: 12px !important;
          font-weight: 600 !important;
          font-size: 1rem !important;
          transition: background-color 0.2s ease !important;
        }

        .custom-btn:hover {
          background-color: #2d41d9 !important;
        }

        .login-visual-side {
          flex: 1;
          background-color: #f4f6fb;
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          position: relative;
        }

        .logo-display-container {
          width: 130px;
          height: 130px;
          background: #ffffff;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 25px rgba(59, 82, 246, 0.1);
          margin-bottom: 24px;
          padding: 16px;
        }

        .visual-logo {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .visual-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a1d2e;
          margin-bottom: 8px;
        }

        .visual-subtitle {
          font-size: 0.85rem;
          color: #7d8597;
          max-width: 280px;
          line-height: 1.4;
          margin-bottom: 24px;
        }

        .visual-dots {
          display: flex;
          gap: 6px;
          margin-bottom: 20px;
        }

        .dot {
          width: 28px;
          height: 4px;
          background-color: #d0d7de;
          border-radius: 2px;
        }

        .dot.active {
          background-color: #3b52f6;
        }

        .footer-copyright {
          position: absolute;
          bottom: 12px;
          font-size: 0.7rem;
          color: #a0a7b5;
        }

        @media (max-width: 768px) {
          .login-card-container {
            flex-direction: column-reverse;
          }
          .login-visual-side {
            padding: 30px 20px 20px;
          }
        }
      `}</style>

      <div className="login-card-container">
        {/* Left Side: Login Form */}
        <div className="login-form-side">
          <h2 className="login-title">Login</h2>

          {error && (
            <Alert variant="danger" className="py-2 small">
              <i className="bi bi-exclamation-circle me-1" />
              {error}
            </Alert>
          )}

          <Form onSubmit={submit}>
            <Form.Group className="mb-3">
              <Form.Label className="custom-label">{t('username')}</Form.Label>
              <Form.Control
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
                autoFocus
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="custom-label">{t('password')}</Form.Label>
              <PasswordInput
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                required
              />
            </Form.Group>

            <Button type="submit" className="custom-btn w-100 mt-2" disabled={loading}>
              {loading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  {t('loggingIn')}
                </>
              ) : (
                t('signIn')
              )}
            </Button>
          </Form>

          {/* Language Toggle */}
          <div className="text-center mt-4">
            <Button
              variant="link"
              size="sm"
              className="text-decoration-none text-muted p-0"
              onClick={() => setLang(lang === 'en' ? 'rw' : 'en')}
            >
              <i className="bi bi-translate me-1" />
              {lang === 'en' ? t('kinyarwanda') : t('english')}
            </Button>
          </div>
        </div>

        {/* Right Side: Logo & App Details */}
        <div className="login-visual-side">
          <div className="logo-display-container">
            <img src="/logo.png" alt="logo" className="visual-logo" />
          </div>
          <h4 className="visual-title">{t('appName')}</h4>
          <p className="visual-subtitle">{t('loginSubtitle')}</p>

          <div className="visual-dots">
            <span className="dot active"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>

          <div className="footer-copyright">
            © {new Date().getFullYear()} Brilliant Construction and Materials Ltd
          </div>
        </div>
      </div>
    </div>
  )
}