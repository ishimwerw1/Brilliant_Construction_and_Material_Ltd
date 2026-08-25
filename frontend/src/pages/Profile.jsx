import { useState } from 'react'
import { Card, Row, Col, Form, Button, Alert, Badge } from 'react-bootstrap'
import api, { getError } from '../api/client'
import PasswordInput from '../components/common/PasswordInput'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Profile() {
  const { user, refreshUser } = useAuth()
  const { t } = useLanguage()
  const [profile, setProfile] = useState({ fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '' })
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' })
  const [msg, setMsg] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  const saveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    setMsg(null)
    try {
      await api.put('/auth/profile', profile)
      await refreshUser()
      setMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err) {
      setMsg({ type: 'danger', text: getError(err) })
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setSavingPwd(true)
    setMsg(null)
    try {
      await api.put('/auth/change-password', pwd)
      setPwd({ currentPassword: '', newPassword: '' })
      setMsg({ type: 'success', text: 'Password changed successfully.' })
    } catch (err) {
      setMsg({ type: 'danger', text: getError(err) })
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: '#0d3b66' }}>
        <i className="bi bi-person-circle me-2" />{t('profile')}
      </h4>

      {msg && <Alert variant={msg.type} dismissible onClose={() => setMsg(null)} className="py-2 small">{msg.text}</Alert>}

      <Row className="g-3">
        <Col lg={4}>
          <Card body className="text-center h-100">
            <span style={{ width: 84, height: 84, borderRadius: '50%', background: '#0d3b66', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 700 }}>
              {(user?.fullName || '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </span>
            <h5 className="mt-3 mb-1 fw-bold">{user?.fullName}</h5>
            <Badge bg="" className={user?.role?.name === 'Super Admin' ? 'badge-soft-danger' : 'badge-soft-primary'}>{user?.role?.name}</Badge>
            <hr />
            <div className="text-start small text-muted">
              <div className="mb-1"><i className="bi bi-at me-2" />@{user?.username}</div>
              <div><i className="bi bi-envelope me-2" />{user?.email}</div>
            </div>
          </Card>
        </Col>

        <Col lg={8}>
          <Card body className="mb-3">
            <h6 className="fw-semibold mb-3">Account Information</h6>
            <Form onSubmit={saveProfile}>
              <Row className="g-3">
                <Col md={12}><Form.Group><Form.Label>{t('fullName')}</Form.Label><Form.Control value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} required /></Form.Group></Col>
                <Col md={6}><Form.Group><Form.Label>{t('email')}</Form.Label><Form.Control type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required /></Form.Group></Col>
                <Col md={6}><Form.Group><Form.Label>{t('phone')}</Form.Label><Form.Control value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Form.Group></Col>
              </Row>
              <Button type="submit" className="mt-3" size="sm" disabled={savingProfile}>
                {savingProfile ? t('saving') : t('save')}
              </Button>
            </Form>
          </Card>

          <Card body>
            <h6 className="fw-semibold mb-3">{t('changePassword')}</h6>
            <Form onSubmit={savePassword}>
              <Row className="g-3">
                <Col md={6}><Form.Group><Form.Label>{t('currentPassword')}</Form.Label><PasswordInput value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} required /></Form.Group></Col>
                <Col md={6}><Form.Group><Form.Label>{t('newPassword')}</Form.Label><PasswordInput value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} minLength={6} required /></Form.Group></Col>
              </Row>
              <Button type="submit" variant="outline-primary" className="mt-3" size="sm" disabled={savingPwd}>
                {savingPwd ? t('saving') : t('changePassword')}
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
