import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, AlertTriangle, ArrowLeft, BarChart3, Camera, Check, ChevronRight,
  CircleUserRound, Clock3, Cloud, Droplets, FileDown, History, Home, ImagePlus,
  Info, Leaf, LoaderCircle, LockKeyhole, LogOut, Plus, RotateCcw, ShieldCheck,
  Sparkles, Trash2, WifiOff, X,
} from 'lucide-react'
import { analyzeDraft, analyzeImageColor, BRISTOL, COLOR_INFO, compressImage } from './analysis'
import AuthScreen from './AuthScreen'
import { clearCloudRecords, createCloudRecord, fetchCloudRecords } from './cloud'
import { clearRecords, DEMO_RECORDS, loadRecords, saveRecords } from './storage'
import { cloudConfigured, supabase } from './supabase'
import type { DraftRecord, Feeling, StoolColor, StoolRecord, Symptom } from './types'

type Tab = 'home' | 'trends' | 'history' | 'profile'
type ComposerStep = 'photo' | 'details' | 'result'

const defaultDraft: DraftRecord = { bristol: 4, color: 'brown', feeling: 'easy', symptoms: [], note: '' }
const RISK_LABEL = { good: '状态良好', watch: '建议观察', attention: '需要关注' }
const FEELING_LABEL: Record<Feeling, string> = { easy: '轻松', 'some-effort': '有点费力', straining: '很费力' }
const SYMPTOM_LABEL: Record<Symptom, string> = { pain: '腹痛', blood: '可见血迹', fever: '发热', nausea: '恶心', dizzy: '头晕乏力' }

function formatDate(value: string, detail = false) {
  const d = new Date(value)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  const prefix = d.toDateString() === today.toDateString() ? '今天' : d.toDateString() === yesterday.toDateString() ? '昨天' : `${d.getMonth() + 1}月${d.getDate()}日`
  return detail ? `${prefix} ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : prefix
}

function Logo() {
  return <div className="logo" aria-label="便知"><span className="logo-lid" /><span className="logo-bowl"><span /></span></div>
}

function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [records, setRecords] = useState<StoolRecord[]>(loadRecords)
  const [composer, setComposer] = useState(false)
  const [selected, setSelected] = useState<StoolRecord | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!cloudConfigured)
  const [guest, setGuest] = useState(!cloudConfigured)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) setGuest(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setSyncing(true); setSyncError('')
    fetchCloudRecords()
      .then(setRecords)
      .catch(() => setSyncError('云端记录加载失败，请稍后重试。'))
      .finally(() => setSyncing(false))
  }, [session])

  const updateRecords = (next: StoolRecord[]) => { setRecords(next); saveRecords(next) }
  const finishRecord = async (record: StoolRecord) => {
    setSyncError('')
    if (!session) { updateRecords([record, ...records.filter(r => !r.demo)]); return }
    setSyncing(true)
    try {
      await createCloudRecord(session.user, record)
      setRecords(current => [record, ...current])
    } catch {
      setSyncError('记录未能同步，请检查网络后重试。')
      throw new Error('sync failed')
    } finally { setSyncing(false) }
  }
  const clearAll = async () => {
    if (session) { setSyncing(true); await clearCloudRecords(); setRecords([]); setSyncing(false) }
    else { clearRecords(); setRecords([]) }
  }

  if (!authReady) return <div className="app-loading"><Logo /><LoaderCircle className="spin" /><span>正在安全连接...</span></div>
  if (!session && !guest) return <AuthScreen onGuest={() => setGuest(true)} />

  return <div className="app-shell">
    {syncError && <div className="sync-toast"><WifiOff />{syncError}<button onClick={() => setSyncError('')}><X /></button></div>}
    <main>
      {tab === 'home' && <HomeView records={records} onAdd={() => setComposer(true)} onOpen={setSelected} />}
      {tab === 'trends' && <TrendsView records={records} />}
      {tab === 'history' && <HistoryView records={records} onOpen={setSelected} />}
      {tab === 'profile' && <ProfileView records={records} email={session?.user.email} syncing={syncing} onReset={() => updateRecords(DEMO_RECORDS)} onClear={clearAll} onLogout={session ? async () => { await supabase?.auth.signOut(); setRecords(DEMO_RECORDS); setGuest(false); setTab('home') } : () => setGuest(false)} />}
    </main>

    <nav className="bottom-nav" aria-label="主导航">
      <NavItem active={tab === 'home'} icon={<Home />} label="今日" onClick={() => setTab('home')} />
      <NavItem active={tab === 'trends'} icon={<BarChart3 />} label="趋势" onClick={() => setTab('trends')} />
      <button className="nav-add" onClick={() => setComposer(true)} aria-label="记录一次"><Plus /></button>
      <NavItem active={tab === 'history'} icon={<History />} label="记录" onClick={() => setTab('history')} />
      <NavItem active={tab === 'profile'} icon={<CircleUserRound />} label="我的" onClick={() => setTab('profile')} />
    </nav>

    {composer && <Composer onClose={() => setComposer(false)} onSave={finishRecord} />}
    {selected && <RecordDetail record={selected} onClose={() => setSelected(null)} />}
  </div>
}

function NavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>
}

function Header() {
  return <header className="topbar"><div className="brand"><Logo /><span>便知</span></div><button className="privacy-pill"><LockKeyhole /> 本地私密</button></header>
}

function HomeView({ records, onAdd, onOpen }: { records: StoolRecord[]; onAdd: () => void; onOpen: (r: StoolRecord) => void }) {
  const recent = records[0]
  const sevenDays = records.filter(r => Date.now() - new Date(r.createdAt).getTime() < 7 * 86400000)
  const goodCount = sevenDays.filter(r => r.risk === 'good').length
  const avg = sevenDays.length ? Math.round(sevenDays.reduce((n, r) => n + r.score, 0) / sevenDays.length) : 0
  const frequencyLabel = sevenDays.length < 3 ? '记录还少' : sevenDays.length <= 21 ? '整体平稳' : '频次偏高'
  const hour = new Date().getHours()
  const greeting = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return <div className="page home-page">
    <Header />
    <section className="greeting"><p>{greeting}</p><h1>今天，肚子还舒服吗？</h1></section>
    <button className="capture-card" onClick={onAdd}>
      <div className="capture-art"><div className="scan-corner tl"/><div className="scan-corner tr"/><div className="scan-corner bl"/><div className="scan-corner br"/><Camera /></div>
      <div className="capture-copy"><span className="eyebrow">快速记录</span><strong>拍照，了解本次状态</strong><small>约 30 秒 · 照片仅存本机</small></div>
      <span className="round-arrow"><ChevronRight /></span>
    </button>

    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">近 7 天</span><h2>你的肠道节律</h2></div><span className="status-chip"><span />{frequencyLabel}</span></div>
      <div className="rhythm-grid">
        <div className="metric"><span>记录次数</span><strong>{sevenDays.length}<i>次</i></strong><small>常见范围 3–21 次</small></div>
        <div className="metric"><span>良好状态</span><strong>{goodCount}<i>次</i></strong><small>{sevenDays.length ? `占比 ${Math.round(goodCount / sevenDays.length * 100)}%` : '等待记录'}</small></div>
        <div className="metric score-metric"><span>平均状态分</span><strong>{avg || '—'}<i>{avg ? '分' : ''}</i></strong><div className="meter"><span style={{ width: `${avg}%` }} /></div></div>
      </div>
    </section>

    {recent ? <section className="section-block last-section">
      <div className="section-heading"><h2>最近一次</h2><button className="text-button" onClick={() => onOpen(recent)}>查看详情 <ChevronRight /></button></div>
      <button className="recent-row" onClick={() => onOpen(recent)}>
        <div className={`score-ring ${recent.risk}`}><strong>{recent.score}</strong><span>状态分</span></div>
        <div className="recent-info"><div><span className={`risk-dot ${recent.risk}`} />{RISK_LABEL[recent.risk]}</div><strong>{BRISTOL[recent.bristol - 1].label} · {COLOR_INFO[recent.color].label}</strong><small><Clock3 /> {formatDate(recent.createdAt, true)}</small></div>
        <ChevronRight className="row-chevron" />
      </button>
    </section> : <EmptyState onAdd={onAdd} />}

    {records.some(r => r.demo) && <div className="demo-note"><Info /><span>当前展示体验数据。完成首次记录后会自动清除。</span></div>}
  </div>
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <section className="empty-state"><Leaf /><h2>从第一次记录开始</h2><p>连续记录，才能更准确地了解自己的节律。</p><button className="primary small" onClick={onAdd}><Plus /> 添加记录</button></section>
}

function TrendsView({ records }: { records: StoolRecord[] }) {
  const recent = records.filter(r => Date.now() - new Date(r.createdAt).getTime() < 7 * 86400000)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    const count = recent.filter(r => new Date(r.createdAt).toDateString() === d.toDateString()).length
    return { label: ['日','一','二','三','四','五','六'][d.getDay()], count, today: i === 6 }
  })
  const ideal = recent.filter(r => r.bristol === 3 || r.bristol === 4).length
  const avg = recent.length ? Math.round(recent.reduce((s, r) => s + r.score, 0) / recent.length) : 0
  return <div className="page">
    <Header />
    <section className="page-title"><span className="eyebrow">身体趋势</span><h1>看见你的规律</h1><p>变化比单次结果更有参考价值。</p></section>
    <section className="chart-panel">
      <div className="section-heading"><div><h2>排便频次</h2><span className="subtle">最近 7 天</span></div><strong className="large-stat">{recent.length}<i>次</i></strong></div>
      <div className="bar-chart">{days.map((day, i) => <div className="bar-col" key={i}><span className="bar-value">{day.count || ''}</span><div className={`bar ${day.count ? 'filled' : ''}`} style={{ height: `${18 + day.count * 34}px` }} /><small className={day.today ? 'today' : ''}>{day.label}</small></div>)}</div>
      <div className="range-note"><Check /> 每周 3–21 次通常属于常见范围，个人规律更重要</div>
    </section>
    <section className="insight-list">
      <article className="insight-card"><div className="insight-icon green"><Activity /></div><div><span>形态稳定度</span><strong>{recent.length ? Math.round(ideal / recent.length * 100) : 0}% 为理想形态</strong><p>{ideal >= Math.max(1, recent.length / 2) ? '近一周以布里斯托 3–4 型为主，保持得不错。' : '近期形态波动较多，建议留意饮水与膳食纤维。'}</p></div></article>
      <article className="insight-card"><div className="insight-icon amber"><Sparkles /></div><div><span>本周观察</span><strong>平均状态分 {avg || '—'}</strong><p>{avg >= 78 ? '节律总体平稳，继续记录即可。' : '有一些变化值得持续观察，不必因单次结果紧张。'}</p></div></article>
      <article className="tip-card"><Droplets /><div><strong>今天的小建议</strong><p>少量多次补水，搭配蔬菜、全谷物和适量活动。</p></div></article>
    </section>
  </div>
}

function HistoryView({ records, onOpen }: { records: StoolRecord[]; onOpen: (r: StoolRecord) => void }) {
  const [filter, setFilter] = useState<'all' | 'attention'>('all')
  const shown = filter === 'all' ? records : records.filter(r => r.risk !== 'good')
  return <div className="page">
    <Header />
    <section className="page-title history-title"><span className="eyebrow">每一次都算数</span><h1>记录</h1></section>
    <div className="segmented"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button><button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>需要留意</button></div>
    <section className="timeline">
      {shown.map((record, i) => <button className="timeline-item" key={record.id} onClick={() => onOpen(record)}>
        <div className="date-col"><strong>{formatDate(record.createdAt)}</strong><span>{new Date(record.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span></div>
        <span className={`timeline-dot ${record.risk}`} />
        {i < shown.length - 1 && <span className="timeline-line" />}
        <div className="record-card">
          {record.photo ? <img src={record.photo} alt="本次记录" /> : <div className="record-shape"><span className={`shape shape-${record.bristol}`} style={{ background: COLOR_INFO[record.color].hex }} /></div>}
          <div><span className={`risk-label ${record.risk}`}>{RISK_LABEL[record.risk]}</span><strong>{BRISTOL[record.bristol - 1].label}</strong><small>{COLOR_INFO[record.color].label} · {FEELING_LABEL[record.feeling]}</small></div>
          <div className="record-score">{record.score}<span>分</span></div>
        </div>
      </button>)}
      {!shown.length && <div className="no-results"><History /><p>这里还没有记录</p></div>}
    </section>
  </div>
}

function ProfileView({ records, email, syncing, onReset, onClear, onLogout }: { records: StoolRecord[]; email?: string; syncing: boolean; onReset: () => void; onClear: () => void | Promise<void>; onLogout: () => void | Promise<void> }) {
  const exportData = () => {
    const blob = new Blob([JSON.stringify(records.map(({ photo: _, ...r }) => r), null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '便知记录.json'; a.click(); URL.revokeObjectURL(a.href)
  }
  return <div className="page">
    <Header />
    <section className="page-title"><span className="eyebrow">我的空间</span><h1>隐私与数据</h1><p>你始终拥有自己的记录。</p></section>
    {email ? <section className="account-hero"><div className="account-avatar">{email.slice(0, 1).toUpperCase()}</div><div><span>已登录账户</span><strong>{email}</strong><small>{syncing ? <><LoaderCircle className="spin" />正在同步</> : <><Cloud />云端已同步</>}</small></div></section>
      : <section className="privacy-hero"><ShieldCheck /><div><strong>本机体验模式</strong><p>照片和健康记录只在当前浏览器。登录后可在其他设备安全同步。</p></div></section>}
    <section className="settings-group">
      <h2>数据管理</h2>
      <button onClick={exportData}><span className="setting-icon"><FileDown /></span><div><strong>导出记录</strong><small>不包含照片的 JSON 文件</small></div><ChevronRight /></button>
      {!email && <button onClick={onReset}><span className="setting-icon"><RotateCcw /></span><div><strong>恢复体验数据</strong><small>便于重新浏览完整界面</small></div><ChevronRight /></button>}
      <button className="danger-row" onClick={() => confirm('确定清除所有本机记录吗？此操作无法撤销。') && onClear()}><span className="setting-icon"><Trash2 /></span><div><strong>清除全部记录</strong><small>照片与记录将无法恢复</small></div><ChevronRight /></button>
      <button onClick={onLogout}><span className="setting-icon"><LogOut /></span><div><strong>{email ? '退出登录' : '登录并开启同步'}</strong><small>{email ? '本机将不再显示该账户的数据' : '在其他电脑和手机访问记录'}</small></div><ChevronRight /></button>
    </section>
    <section className="medical-note"><AlertTriangle /><div><strong>健康提示</strong><p>便知用于日常健康记录，不能替代医生诊断。出现大量便血、黑色柏油样便、剧烈腹痛、持续发热或明显乏力时，请及时就医。</p></div></section>
    <p className="version">便知 H5 · 测试版 0.1</p>
  </div>
}

function Composer({ onClose, onSave }: { onClose: () => void; onSave: (r: StoolRecord) => void | Promise<void> }) {
  const [step, setStep] = useState<ComposerStep>('photo')
  const [draft, setDraft] = useState<DraftRecord>(defaultDraft)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const result = useMemo(() => analyzeDraft(draft), [draft])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file?: File) => {
    if (!file) return
    setAnalyzing(true)
    const photo = await compressImage(file)
    const color = await analyzeImageColor(photo)
    setDraft(d => ({ ...d, photo, color, photoAnalyzed: true }))
    window.setTimeout(() => { setAnalyzing(false); setStep('details') }, 850)
  }
  const complete = async () => {
    const record: StoolRecord = { ...draft, ...result, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    setSaving(true); setSaveError('')
    try { await onSave(record); onClose() }
    catch { setSaveError('同步失败，记录尚未保存，请检查网络后重试。') }
    finally { setSaving(false) }
  }
  return <div className="modal-layer">
    <div className="composer">
      <div className="modal-header"><button onClick={step === 'photo' ? onClose : () => setStep(step === 'result' ? 'details' : 'photo')}><ArrowLeft /></button><span>{step === 'photo' ? '拍照记录' : step === 'details' ? '确认本次状态' : '分析结果'}</span><button onClick={onClose}><X /></button></div>
      <div className="progress"><span className={step !== 'photo' ? 'done' : 'active'} /><span className={step === 'details' ? 'active' : step === 'result' ? 'done' : ''} /><span className={step === 'result' ? 'active' : ''} /></div>
      {step === 'photo' && <PhotoStep analyzing={analyzing} draft={draft} onPick={() => inputRef.current?.click()} onSkip={() => setStep('details')} />}
      {step === 'details' && <DetailsStep draft={draft} setDraft={setDraft} onSave={() => setStep('result')} />}
      {step === 'result' && <ResultStep draft={draft} result={result} onDone={complete} saving={saving} saveError={saveError} />}
      <input ref={inputRef} hidden type="file" accept="image/*" capture="environment" onChange={e => handleFile(e.target.files?.[0])} />
    </div>
  </div>
}

function PhotoStep({ analyzing, draft, onPick, onSkip }: { analyzing: boolean; draft: DraftRecord; onPick: () => void; onSkip: () => void }) {
  return <div className="step photo-step">
    <div className={`photo-stage ${draft.photo ? 'has-photo' : ''}`}>
      {draft.photo ? <img src={draft.photo} alt="待分析照片" /> : <><div className="camera-orbit"><Camera /></div><h2>拍下本次便便</h2><p>保持光线自然，尽量从正上方拍摄</p></>}
      {analyzing && <div className="analyzing"><div className="scan-line"/><Sparkles/><strong>正在分析颜色与形态...</strong><span>照片仅在本机处理</span></div>}
    </div>
    <div className="photo-actions"><button className="primary" onClick={onPick}><Camera /> 拍照或选择照片</button><button className="secondary" onClick={onSkip}><ImagePlus /> 暂不拍照，手动记录</button></div>
    <p className="privacy-caption"><LockKeyhole /> 照片不会离开你的设备</p>
  </div>
}

function DetailsStep({ draft, setDraft, onSave }: { draft: DraftRecord; setDraft: React.Dispatch<React.SetStateAction<DraftRecord>>; onSave: () => void }) {
  const toggleSymptom = (s: Symptom) => setDraft(d => ({ ...d, symptoms: d.symptoms.includes(s) ? d.symptoms.filter(v => v !== s) : [...d.symptoms, s] }))
  return <div className="step details-step">
    {draft.photoAnalyzed && <div className="ai-prefill"><Sparkles /><div><strong>照片辅助识别完成</strong><span>已预填颜色，请按实际情况确认</span></div><Check /></div>}
    <section className="form-section"><div className="form-heading"><span>01</span><div><h2>形态接近哪一种？</h2><p>参考布里斯托大便分类法</p></div></div>
      <div className="bristol-grid">{BRISTOL.map(item => <button key={item.n} className={draft.bristol === item.n ? 'selected' : ''} onClick={() => setDraft(d => ({ ...d, bristol: item.n }))}><span className={`bristol-shape type-${item.n}`}>{Array.from({ length: item.n === 1 ? 5 : item.n === 6 ? 4 : 1 }, (_, i) => <i key={i} />)}</span><strong>{item.n}型</strong><small>{item.hint}</small></button>)}</div>
    </section>
    <section className="form-section"><div className="form-heading"><span>02</span><div><h2>颜色最接近</h2><p>自然光下观察更准确</p></div></div>
      <div className="color-grid">{(Object.keys(COLOR_INFO) as StoolColor[]).map(color => <button key={color} className={draft.color === color ? 'selected' : ''} onClick={() => setDraft(d => ({ ...d, color }))}><i style={{ background: COLOR_INFO[color].hex }} />{COLOR_INFO[color].label}{draft.color === color && <Check />}</button>)}</div>
    </section>
    <section className="form-section"><div className="form-heading"><span>03</span><div><h2>过程感觉</h2></div></div>
      <div className="choice-row">{(Object.keys(FEELING_LABEL) as Feeling[]).map(f => <button key={f} className={draft.feeling === f ? 'selected' : ''} onClick={() => setDraft(d => ({ ...d, feeling: f }))}>{FEELING_LABEL[f]}</button>)}</div>
    </section>
    <section className="form-section"><div className="form-heading"><span>04</span><div><h2>有没有不适？</h2><p>可多选</p></div></div>
      <div className="symptom-grid">{(Object.keys(SYMPTOM_LABEL) as Symptom[]).map(s => <button key={s} className={draft.symptoms.includes(s) ? 'selected warning' : ''} onClick={() => toggleSymptom(s)}>{SYMPTOM_LABEL[s]}</button>)}</div>
      <textarea value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} placeholder="备注饮食、用药或其他情况（选填）" maxLength={120} />
    </section>
    <div className="sticky-submit"><button className="primary" onClick={onSave}><Sparkles /> 生成本次分析</button></div>
  </div>
}

function ResultStep({ draft, result, onDone, saving, saveError }: { draft: DraftRecord; result: ReturnType<typeof analyzeDraft>; onDone: () => void; saving: boolean; saveError: string }) {
  const urgent = draft.color === 'black' || draft.color === 'red' || draft.color === 'pale' || draft.symptoms.includes('blood') || draft.symptoms.includes('dizzy')
  return <div className="step result-step">
    <div className={`result-hero ${result.risk}`}>
      <span className="result-kicker">本次健康状态</span>
      <div className="big-score"><strong>{result.score}</strong><span>/ 100</span></div>
      <h2>{RISK_LABEL[result.risk]}</h2><p>{result.summary}</p>
      <div className="score-track"><span style={{ width: `${result.score}%` }} /></div>
    </div>
    <div className="result-facts"><div><span>形态</span><strong>{draft.bristol} 型 · {BRISTOL[draft.bristol - 1].hint}</strong></div><div><span>颜色</span><strong><i style={{ background: COLOR_INFO[draft.color].hex }} />{COLOR_INFO[draft.color].label}</strong></div><div><span>过程</span><strong>{FEELING_LABEL[draft.feeling]}</strong></div></div>
    {urgent ? <div className="urgent-card"><AlertTriangle /><div><strong>建议尽快咨询医生</strong><p>如果不是食物、铁剂或药物导致，或同时伴有明显不适，请及时就医。大量便血、黑色柏油样便或剧烈腹痛应立即就医。</p></div></div> : <div className="advice-card"><Leaf /><div><strong>{result.risk === 'good' ? '继续保持' : '接下来可以这样做'}</strong><p>{draft.bristol <= 2 ? '增加饮水和富含纤维的食物，保持适量活动。' : draft.bristol >= 6 ? '注意补充水分，饮食清淡；若持续超过 2–3 天或伴随不适，请咨询医生。' : '保持规律饮食、充足饮水和适量活动，继续观察自己的长期节律。'}</p></div></div>}
    <div className="disclaimer"><Info /> 基于你提供的信息生成，仅供日常健康参考，不构成医疗诊断。</div>
    {saveError && <p className="save-error">{saveError}</p>}
    <button className="primary" onClick={onDone} disabled={saving}>{saving ? <><LoaderCircle className="spin" />正在保存...</> : <><Check />完成记录</>}</button>
  </div>
}

function RecordDetail({ record, onClose }: { record: StoolRecord; onClose: () => void }) {
  return <div className="modal-layer"><div className="detail-sheet">
    <div className="modal-header"><span /><strong>{formatDate(record.createdAt, true)}</strong><button onClick={onClose}><X /></button></div>
    {record.photo && <img className="detail-photo" src={record.photo} alt="记录照片" />}
    <div className={`detail-score ${record.risk}`}><div><span>状态分</span><strong>{record.score}</strong></div><div><span className={`risk-label ${record.risk}`}>{RISK_LABEL[record.risk]}</span><p>{record.summary}</p></div></div>
    <div className="detail-grid"><div><span>形态</span><strong>{record.bristol} 型</strong><small>{BRISTOL[record.bristol - 1].label}</small></div><div><span>颜色</span><strong>{COLOR_INFO[record.color].label}</strong><small>{COLOR_INFO[record.color].note}</small></div><div><span>过程</span><strong>{FEELING_LABEL[record.feeling]}</strong><small>{record.symptoms.length ? record.symptoms.map(s => SYMPTOM_LABEL[s]).join('、') : '无其他不适'}</small></div></div>
    {record.note && <div className="record-note"><span>备注</span><p>{record.note}</p></div>}
    <div className="disclaimer"><Info /> 本结果仅供健康记录参考，不能代替专业医疗诊断。</div>
  </div></div>
}

export default App
