import Papa from 'papaparse'
import { format, parse, parseISO, isValid } from 'date-fns'
import type { ImportRow } from './types'

// Supported inputs:
//  1. Generic long format:  date,key,value[,label,unit]
//  2. Generic wide format:  date,steps,sleep_hours,weight_kg,...   (one column per metric)
//  3. Strava "activities.csv" export (Activity Date, Distance, Moving Time, Elevation Gain)

type Row = Record<string, string>

function toISODate(raw: string): string | null {
  const s = raw.trim()
  const iso = parseISO(s)
  if (isValid(iso)) return format(iso, 'yyyy-MM-dd')
  for (const f of ['MMM d, yyyy, h:mm:ss a', 'MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy/MM/dd', 'd MMM yyyy']) {
    const d = parse(s, f, new Date())
    if (isValid(d)) return format(d, 'yyyy-MM-dd')
  }
  return null
}

const humanize = (s: string) =>
  s.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const num = (v: string | undefined) => {
  const n = parseFloat((v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export function parseCsv(text: string): { rows: ImportRow[]; format: string; skipped: number } {
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() })
  const data = parsed.data
  const headers = parsed.meta.fields ?? []
  const lower = headers.map((h) => h.toLowerCase())
  let skipped = 0

  if (lower.includes('activity date') && lower.includes('distance')) {
    // Strava: aggregate per day
    const byDay = new Map<string, { km: number; min: number; elev: number }>()
    for (const r of data) {
      const date = toISODate(r['Activity Date'] ?? '')
      if (!date) { skipped++; continue }
      const cur = byDay.get(date) ?? { km: 0, min: 0, elev: 0 }
      cur.km += num(r['Distance']) ?? 0
      cur.min += (num(r['Moving Time']) ?? 0) / 60
      cur.elev += num(r['Elevation Gain']) ?? 0
      byDay.set(date, cur)
    }
    const rows: ImportRow[] = []
    for (const [date, v] of byDay) {
      rows.push({ key: 'distance_km', label: 'Distance', unit: 'km', date, value: Math.round(v.km * 100) / 100, source: 'strava' })
      rows.push({ key: 'active_minutes', label: 'Active minutes', unit: 'min', date, value: Math.round(v.min), source: 'strava' })
      if (v.elev) rows.push({ key: 'elevation_m', label: 'Elevation gain', unit: 'm', date, value: Math.round(v.elev), source: 'strava' })
    }
    return { rows, format: 'Strava activities', skipped }
  }

  const dateCol = headers[lower.indexOf('date')] ?? headers[lower.findIndex((h) => h.includes('date'))]
  if (!dateCol) throw new Error('No "date" column found')

  if (lower.includes('key') && lower.includes('value')) {
    const rows: ImportRow[] = []
    for (const r of data) {
      const date = toISODate(r[dateCol] ?? '')
      const value = num(r[headers[lower.indexOf('value')]])
      const key = (r[headers[lower.indexOf('key')]] ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
      if (!date || value === null || !key) { skipped++; continue }
      rows.push({ key, date, value, label: r['label'] || undefined, unit: r['unit'] || undefined, source: 'csv' })
    }
    return { rows, format: 'long (date,key,value)', skipped }
  }

  const metricCols = headers.filter((h) => h !== dateCol)
  const rows: ImportRow[] = []
  for (const r of data) {
    const date = toISODate(r[dateCol] ?? '')
    if (!date) { skipped++; continue }
    for (const col of metricCols) {
      const value = num(r[col])
      if (value === null) continue
      const key = col.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
      rows.push({ key, label: humanize(col), date, value, source: 'csv' })
    }
  }
  return { rows, format: 'wide (one column per metric)', skipped }
}
