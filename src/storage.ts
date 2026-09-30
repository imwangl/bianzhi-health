import type { StoolRecord } from './types'

const KEY = 'bianzhi.records.v1'

const daysAgo = (days: number, hour: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 18 + days, 0, 0)
  return d.toISOString()
}

export const DEMO_RECORDS: StoolRecord[] = [
  { id: 'demo-1', createdAt: daysAgo(0, 8), bristol: 4, color: 'brown', feeling: 'easy', symptoms: [], note: '', score: 94, risk: 'good', summary: '本次状态整体在常见健康范围内', demo: true },
  { id: 'demo-2', createdAt: daysAgo(1, 9), bristol: 3, color: 'dark-brown', feeling: 'easy', symptoms: [], note: '', score: 92, risk: 'good', summary: '本次状态整体在常见健康范围内', demo: true },
  { id: 'demo-3', createdAt: daysAgo(3, 7), bristol: 5, color: 'brown', feeling: 'easy', symptoms: [], note: '昨天吃了不少水果', score: 86, risk: 'good', summary: '本次状态整体在常见健康范围内', demo: true },
  { id: 'demo-4', createdAt: daysAgo(4, 8), bristol: 2, color: 'brown', feeling: 'some-effort', symptoms: [], note: '', score: 71, risk: 'watch', summary: '本次偏硬，建议补水并继续观察', demo: true },
  { id: 'demo-5', createdAt: daysAgo(6, 8), bristol: 4, color: 'brown', feeling: 'easy', symptoms: [], note: '', score: 95, risk: 'good', summary: '本次状态整体在常见健康范围内', demo: true },
]

export function loadRecords(): StoolRecord[] {
  try {
    const saved = localStorage.getItem(KEY)
    return saved ? JSON.parse(saved) : DEMO_RECORDS
  } catch { return DEMO_RECORDS }
}

export function saveRecords(records: StoolRecord[]) {
  try { localStorage.setItem(KEY, JSON.stringify(records.slice(0, 60))) }
  catch {
    const withoutPhotos = records.map(({ photo: _, ...record }) => record)
    localStorage.setItem(KEY, JSON.stringify(withoutPhotos.slice(0, 60)))
  }
}

export function clearRecords() { localStorage.setItem(KEY, '[]') }
