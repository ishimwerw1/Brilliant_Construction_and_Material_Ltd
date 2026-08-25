import { useState } from 'react'
import { Table, Pagination, Form, InputGroup, Button } from 'react-bootstrap'
import { useLanguage } from '../../context/LanguageContext'

export default function DataTable({ columns, data, loading, page, pages, total, onPageChange, search, onSearchChange, searchPlaceholder, toolbar, emptyText }) {
  const { t } = useLanguage()
  const [localSearch, setLocalSearch] = useState('')

  return (
    <div>
      {(onSearchChange || toolbar) && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          {onSearchChange ? (
            <InputGroup style={{ maxWidth: 340 }}>
              <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
              <Form.Control
                placeholder={searchPlaceholder || t('searchPlaceholder')}
                value={search ?? localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value)
                  onSearchChange?.(e.target.value)
                }}
              />
            </InputGroup>
          ) : <span />}
          <div className="d-flex gap-2 flex-wrap">{toolbar}</div>
        </div>
      )}

      <div className="table-responsive">
        <Table hover size="sm" className="align-middle bg-white mb-2">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ minWidth: col.minWidth }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-4 text-muted">
                  <span className="spinner-border spinner-border-sm me-2" />{t('loading')}
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-5 text-muted empty-state">
                  <i className="bi bi-inbox" />
                  {emptyText || t('noData')}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr key={row._id || idx}>
                  {columns.map((col) => (
                    <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>

      {pages > 1 && (
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <small className="text-muted">
            {t('page')} {page} {t('of')} {pages} · {total?.toLocaleString()} {t('records')}
          </small>
          <Pagination size="sm" className="mb-0">
            <Pagination.First disabled={page <= 1} onClick={() => onPageChange(1)} />
            <Pagination.Prev disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              let p
              if (pages <= 5) p = i + 1
              else if (page <= 3) p = i + 1
              else if (page >= pages - 2) p = pages - 4 + i
              else p = page - 2 + i
              return <Pagination.Item key={p} active={p === page} onClick={() => onPageChange(p)}>{p}</Pagination.Item>
            })}
            <Pagination.Next disabled={page >= pages} onClick={() => onPageChange(page + 1)} />
            <Pagination.Last disabled={page >= pages} onClick={() => onPageChange(pages)} />
          </Pagination>
        </div>
      )}
    </div>
  )
}
