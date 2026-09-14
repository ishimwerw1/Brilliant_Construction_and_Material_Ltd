import { useEffect, useRef, useState } from 'react'
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
    const onScroll = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return
      setOpen(false)
    }
    const onResize = () => setOpen(false)
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (open) { setOpen(false); return }
    const isSheet = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 575.98px)').matches
    setSheet(isSheet)
    if (isSheet) { setCoords(null); setOpen(true); return }

    const entries = (items || []).filter(Boolean)
    const r = btnRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 8
    const est = (header ? 44 : 0) + entries.reduce((s, it) => s + (it.divider ? 22 : 42), 0)
    const up = r.bottom + gap + est > vh - gap
    setCoords({
      left: Math.max(gap, Math.min(r.left, vw - 230 - gap)),
      top: up ? undefined : r.bottom + gap,
      bottom: up ? vh - r.top + gap : undefined,
      up
    })
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
          className={
            sheet
              ? 'loan-item-menu loan-item-menu--sheet'
              : 'loan-item-menu loan-item-menu--float' + (coords?.up ? ' loan-item-menu--up' : '')
          }
          style={!sheet && coords ? { left: coords.left, top: coords.top, bottom: coords.bottom } : undefined}
        >
          {header && (
            <div className="loan-item-menu__header small fw-bold">{header}</div>
          )}
          <div className="loan-item-menu__body">
            {(items || []).filter(Boolean).map((it, i) => {
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