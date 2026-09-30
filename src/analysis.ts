import type { DraftRecord, RiskLevel, StoolColor, StoolRecord } from './types'

export const COLOR_INFO: Record<StoolColor, { label: string; hex: string; note: string }> = {
  brown: { label: '棕色', hex: '#875a36', note: '常见健康色' },
  'dark-brown': { label: '深棕', hex: '#563d2c', note: '通常属正常范围' },
  green: { label: '绿色', hex: '#66834d', note: '可能与饮食或通过较快有关' },
  yellow: { label: '黄色', hex: '#d4aa3f', note: '偶发可观察，持续需留意' },
  black: { label: '黑色', hex: '#242321', note: '排除铁剂/食物后需及时关注' },
  red: { label: '鲜红', hex: '#b84038', note: '可能与食物或出血有关' },
  pale: { label: '灰白', hex: '#d8d1bc', note: '持续出现建议就医' },
}

export const BRISTOL = [
  { n: 1, label: '分离硬块', hint: '很硬' },
  { n: 2, label: '块状香肠', hint: '偏硬' },
  { n: 3, label: '表面裂纹', hint: '较理想' },
  { n: 4, label: '光滑柔软', hint: '理想' },
  { n: 5, label: '柔软小块', hint: '偏软' },
  { n: 6, label: '蓬松糊状', hint: '较稀' },
  { n: 7, label: '水样无固体', hint: '水样' },
]

export function analyzeDraft(draft: DraftRecord): Pick<StoolRecord, 'score' | 'risk' | 'summary'> {
  let score = 92
  const concerns: string[] = []
  const urgentColor = draft.color === 'black' || draft.color === 'red' || draft.color === 'pale'
  const redFlag = urgentColor || draft.symptoms.includes('blood') || draft.symptoms.includes('dizzy')
    || (draft.symptoms.includes('fever') && draft.bristol >= 6)

  if (draft.bristol <= 2) { score -= draft.bristol === 1 ? 24 : 15; concerns.push('偏硬') }
  if (draft.bristol >= 6) { score -= draft.bristol === 7 ? 28 : 17; concerns.push('偏稀') }
  if (draft.bristol === 5) score -= 6
  if (draft.color === 'green' || draft.color === 'yellow') score -= 10
  if (urgentColor) score -= 32
  if (draft.feeling === 'some-effort') score -= 6
  if (draft.feeling === 'straining') { score -= 15; concerns.push('排便费力') }
  score -= draft.symptoms.length * 9
  score = Math.max(18, Math.min(98, score))

  let risk: RiskLevel = score >= 78 ? 'good' : score >= 55 ? 'watch' : 'attention'
  if (redFlag) risk = 'attention'
  else if (draft.symptoms.length && risk === 'good') risk = 'watch'
  const summary = risk === 'good'
    ? '本次状态整体在常见健康范围内'
    : risk === 'watch'
      ? `本次${concerns.join('、') || '有轻微变化'}，建议补水并继续观察`
      : '发现需要留意的信号，请结合持续时间和身体感受判断'
  return { score, risk, summary }
}

export function analyzeImageColor(dataUrl: string): Promise<StoolColor> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 48
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(image, 0, 0, 48, 48)
      const pixels = ctx.getImageData(8, 8, 32, 32).data
      let r = 0, g = 0, b = 0, count = 0
      for (let i = 0; i < pixels.length; i += 16) {
        const brightness = pixels[i] + pixels[i + 1] + pixels[i + 2]
        if (brightness > 90 && brightness < 690) {
          r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++
        }
      }
      r /= count || 1; g /= count || 1; b /= count || 1
      if (r < 52 && g < 52 && b < 52) return resolve('black')
      if (r > g * 1.45 && r > b * 1.6) return resolve('red')
      if (g > r * 1.08) return resolve('green')
      if (r > 145 && g > 115 && b < 100) return resolve('yellow')
      if (r + g + b > 570) return resolve('pale')
      resolve(r + g + b < 250 ? 'dark-brown' : 'brown')
    }
    image.onerror = () => resolve('brown')
    image.src = dataUrl
  })
}

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const max = 900
        const scale = Math.min(1, max / Math.max(image.width, image.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(image.width * scale)
        canvas.height = Math.round(image.height * scale)
        canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', .72))
      }
      image.onerror = reject
      image.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
