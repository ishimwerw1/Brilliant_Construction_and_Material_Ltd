import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function MoreMenu({ header, items, toggleClass }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const [sheet, setSheet] = useState(false)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || coords || !menuRef.current) return
    const m = menuRef.current.getBoundingClientRect()
    const r = btnRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 8
    let top = r.bottom + gap
    const left = Math.max(gap, Math.min(r.left, vw - m.width - gap))
    if (top + m.height > vh - gap) top = Math.max(gap, r.top - m.height - gap)
    setCoords({ top, left })
  }, [open, coords])

  const toggle = () => {
    if (open) { setOpen(false); return }
    setSheet(typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 575.98px)').matches)
    setCoords(null)
    setOpen(true)
  }

  const pick = (onClick) => {
    setOpen(false)
    if (onClick) onClick()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`btn btn-sm btn-light border-0 px-1 loan-item-menu-toggle ${toggleClass || ''}`}
        title="Actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <i className="bi bi-three-dots-vertical fs-6" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className={sheet ? 'loan-item-menu loan-item-menu--sheet' : 'loan-item-menu loan-item-menu--float'}
          style={!sheet && !coords ? { visibility: 'hidden' } : undefined}
        >
          {header && (
            <div className="loan-item-menu__header small fw-bold">{header}</div>
          )}
          <div className="loan-item-menu__body">
            {items.filter(Boolean).map((it, i) => {
              if (it.divider) return <div key={`sep-${i}`} className="loan-item-menu__sep" />
              return (
                <button
                  key={it.key || i}
                  type="button"
                  className={`loan-item-menu__item ${it.danger ? 'loan-item-menu__item--danger' : ''}`}
                  onClick={() => pick(it.onClick)}
                >
                  {it.icon && <i className={`bi ${it.icon} me-2`} />}
                  {it.label}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}