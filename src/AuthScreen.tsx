import { useState } from 'react'
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { cloudConfigured, supabase } from './supabase'

function AuthLogo() {
  return <div className="auth-logo" aria-label="便知"><span /><i /></div>
}

export default function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(''); setMessage('')
    if (!supabase) { setError('云端服务尚未配置，请先使用本机体验。'); return }
    if (password.length < 6) { setError('密码至少需要 6 位。'); return }
    setLoading(true)
    const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
    setLoading(false)
    if (result.error) { setError(result.error.message === 'Invalid login credentials' ? '邮箱或密码不正确。' : result.error.message); return }
    if (mode === 'signup' && !result.data.session) setMessage('注册成功，请前往邮箱完成验证后登录。')
  }

  return <div className="auth-page">
    <div className="auth-top">
      <AuthLogo />
      <span>便知</span>
    </div>
    <div className="auth-intro">
      <span className="eyebrow">你的私人健康记录</span>
      <h1>{mode === 'login' ? '欢迎回来' : '创建你的账户'}</h1>
      <p>登录后，记录会加密传输并安全同步到你的所有设备。</p>
    </div>
    <div className="auth-card">
      <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }}>登录</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError('') }}>注册</button></div>
      <form onSubmit={submit}>
        <label><span>邮箱</span><div><Mail /><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" required /></div></label>
        <label><span>密码</span><div><LockKeyhole /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 6 位" required minLength={6} /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success"><Check />{message}</p>}
        <button className="primary auth-submit" disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <>{mode === 'login' ? '登录并同步' : '注册账户'}<ArrowRight /></>}</button>
      </form>
      <div className="auth-security"><ShieldCheck /><span>每个账户的数据由数据库权限独立隔离</span></div>
    </div>
    <button className="guest-entry" onClick={onGuest}>暂不登录，使用本机体验</button>
    {!cloudConfigured && <p className="setup-badge">当前为本地开发模式，连接 Supabase 后即可注册登录</p>}
  </div>
}
