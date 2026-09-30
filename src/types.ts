export type StoolColor = 'brown' | 'dark-brown' | 'green' | 'yellow' | 'black' | 'red' | 'pale'
export type Feeling = 'easy' | 'some-effort' | 'straining'
export type Symptom = 'pain' | 'blood' | 'fever' | 'nausea' | 'dizzy'
export type RiskLevel = 'good' | 'watch' | 'attention'

export interface StoolRecord {
  id: string
  createdAt: string
  bristol: number
  color: StoolColor
  feeling: Feeling
  symptoms: Symptom[]
  note: string
  photo?: string
  photoAnalyzed?: boolean
  score: number
  risk: RiskLevel
  summary: string
  demo?: boolean
}

export interface DraftRecord {
  photo?: string
  photoAnalyzed?: boolean
  bristol: number
  color: StoolColor
  feeling: Feeling
  symptoms: Symptom[]
  note: string
}
