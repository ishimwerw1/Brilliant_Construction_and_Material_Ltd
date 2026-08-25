import { useState } from 'react'
import { InputGroup, Form, Button } from 'react-bootstrap'

export default function PasswordInput({ value, onChange, placeholder, required, minLength, autoFocus, isInvalid }) {
  const [show, setShow] = useState(false)
  return (
    <InputGroup className={isInvalid ? 'is-invalid' : ''}>
      <Form.Control
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        autoComplete="new-password"
      />
      <Button
        variant="outline-secondary"
        type="button"
        tabIndex={-1}
        className="pw-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
      >
        <i className={`bi ${show ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`} />
      </Button>
    </InputGroup>
  )
}
