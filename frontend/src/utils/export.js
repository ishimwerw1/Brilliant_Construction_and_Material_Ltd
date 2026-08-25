export const toCsv = (rows, headers) => {
  const escape = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return /[",\n]/.test(s) ? `"${s}"` : s
  }
  const lines = [headers.map((h) => escape(h.label)).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escape(typeof h.key === 'function' ? h.key(row) : row[h.key])).join(','))
  }
  return '\uFEFF' + lines.join('\n')
}

export const downloadCsv = (filename, rows, headers) => {
  const blob = new Blob([toCsv(rows, headers)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const downloadExcel = (filename, rows, headers) =>
  downloadCsv(filename.endsWith('.xls') ? filename : `${filename}.xls`, rows, headers)
