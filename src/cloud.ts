import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { StoolRecord } from './types'

interface RecordRow {
  id: string
  created_at: string
  bristol: number
  color: StoolRecord['color']
  feeling: StoolRecord['feeling']
  symptoms: StoolRecord['symptoms']
  note: string
  score: number
  risk: StoolRecord['risk']
  summary: string
  photo_path: string | null
}

function rowToRecord(row: RecordRow, photo?: string): StoolRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    bristol: row.bristol,
    color: row.color,
    feeling: row.feeling,
    symptoms: row.symptoms || [],
    note: row.note || '',
    score: row.score,
    risk: row.risk,
    summary: row.summary,
    photo,
  }
}

export async function fetchCloudRecords(): Promise<StoolRecord[]> {
  if (!supabase) return []
  const client = supabase
  const { data, error } = await client
    .from('stool_records')
    .select('id,created_at,bristol,color,feeling,symptoms,note,score,risk,summary,photo_path')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error

  return Promise.all((data as RecordRow[]).map(async row => {
    if (!row.photo_path) return rowToRecord(row)
    const { data: signed } = await client.storage.from('stool-photos').createSignedUrl(row.photo_path, 3600)
    return rowToRecord(row, signed?.signedUrl)
  }))
}

export async function createCloudRecord(user: User, record: StoolRecord): Promise<StoolRecord> {
  if (!supabase) throw new Error('云端服务尚未配置')
  let photoPath: string | null = null

  if (record.photo?.startsWith('data:')) {
    const blob = await fetch(record.photo).then(response => response.blob())
    photoPath = `${user.id}/${record.id}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('stool-photos')
      .upload(photoPath, blob, { contentType: 'image/jpeg', upsert: false })
    if (uploadError) throw uploadError
  }

  const { error } = await supabase.from('stool_records').insert({
    id: record.id,
    user_id: user.id,
    created_at: record.createdAt,
    bristol: record.bristol,
    color: record.color,
    feeling: record.feeling,
    symptoms: record.symptoms,
    note: record.note,
    score: record.score,
    risk: record.risk,
    summary: record.summary,
    photo_path: photoPath,
  })
  if (error) {
    if (photoPath) await supabase.storage.from('stool-photos').remove([photoPath])
    throw error
  }
  return record
}

export async function clearCloudRecords() {
  if (!supabase) return
  const { data, error: readError } = await supabase.from('stool_records').select('photo_path')
  if (readError) throw readError
  const paths = (data || []).map(row => row.photo_path).filter(Boolean) as string[]
  if (paths.length) {
    const { error: photoError } = await supabase.storage.from('stool-photos').remove(paths)
    if (photoError) throw photoError
  }
  const { error } = await supabase.from('stool_records').delete().not('id', 'is', null)
  if (error) throw error
}
