/* A spreadsheet of the rows on screen. The BOM makes Excel read UTF-8 (Amharic
   names included) instead of guessing a Windows code page.

   Anything typed into a public form ends up in these files, so a cell that
   Excel would run as a formula (=HYPERLINK(…), @SUM, a DDE "-cmd|…") is
   defused with a leading apostrophe. Plain numbers and phone numbers such as
   +251 911 … are left as they are. */
const looksLikeFormula = (s) => /^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().+-]*$/.test(s)

export function csvCell(v) {
  let s = v == null ? '' : String(v)
  if (looksLikeFormula(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(filename, columns, rows) {
  const lines = [
    columns.map((c) => csvCell(c.label)).join(','),
    ...rows.map((r) => columns.map((c) => csvCell(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(',')),
  ]
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
