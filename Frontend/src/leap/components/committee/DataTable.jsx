import { useEffect, useMemo, useState } from 'react'

const ICON_PROPS = {
  viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
}
function IconSearch() {
  return <svg {...ICON_PROPS}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-3.6-3.6" /></svg>
}
function IconDownload() {
  return <svg {...ICON_PROPS}><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 19h16" /></svg>
}

const PAGE_SIZES = [10, 25, 50, 100]

const escapeCsv = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// A search + sort + paginate + CSV-export table, shared by every drill-down that just
// wants a plain list rendered well — one implementation instead of three near-identical
// ones (booth-wise fill, sections, members).
//
// Column shape: { key, label, numeric?, sortable?, searchable?, exportable?,
//   value?(row), sortValue?(row), csvValue?(row), render?(row) }
// `value` is the plain display fallback; `render` overrides display only (used for the
// per-row delete buttons); export always uses `csvValue` -> `value` -> `row[key]`.
export default function DataTable({ columns, rows, rowKey, searchPlaceholder = 'Search…', filename = 'export', tall = false }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => { setPage(1) }, [search, pageSize, rows])

  const textOf = (col, row) => (col.value ? col.value(row) : row[col.key])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    const searchable = columns.filter((c) => c.searchable !== false)
    return rows.filter((r) => searchable.some((c) => String(textOf(c, r) ?? '').toLowerCase().includes(needle)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, columns])

  const sorted = useMemo(() => {
    if (!sort.key) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return filtered
    const getVal = col.sortValue || ((r) => textOf(col, r))
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = getVal(a); const bv = getVal(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return dir * (av - bv)
      return dir * String(av).localeCompare(String(bv))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize)

  const toggleSort = (key) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }))

  const downloadCsv = () => {
    const exportCols = columns.filter((c) => c.exportable !== false)
    const header = exportCols.map((c) => escapeCsv(c.label)).join(',')
    const lines = sorted.map((r) =>
      exportCols.map((c) => escapeCsv(c.csvValue ? c.csvValue(r) : textOf(c, r))).join(',')
    )
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="leap-dash-toolbar">
        <div className="leap-search-field">
          <span className="leap-search-icon"><IconSearch /></span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        <button type="button" className="leap-btn-secondary" onClick={downloadCsv} disabled={sorted.length === 0}>
          <IconDownload /> Download CSV
        </button>
      </div>

      <div className={`leap-table-card${tall ? ' leap-table-card-tall' : ''}`}>
        <table className="leap-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.numeric ? 'leap-th-numeric' : undefined}>
                  {c.sortable === false ? c.label : (
                    <button
                      type="button"
                      className={`leap-th-sort ${sort.key === c.key ? 'active' : ''}`}
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                      <span className="leap-th-arrow">{sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr className="leap-table-empty-row">
                <td colSpan={columns.length}>{search ? 'No row matches that search.' : 'No data available.'}</td>
              </tr>
            )}
            {pageRows.map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={c.numeric ? 'leap-td-numeric' : undefined}>
                    {c.render ? c.render(r) : (textOf(c, r) ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="leap-dt-pagination">
        <span className="leap-section-sub">
          {sorted.length} row{sorted.length !== 1 ? 's' : ''}{search ? ` (filtered from ${rows.length})` : ''}
        </span>
        <div className="leap-dt-pagination-controls">
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <button type="button" className="leap-btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" className="leap-btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
        </div>
      </div>
    </div>
  )
}
