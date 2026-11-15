import { useState } from 'react'
import { useStore } from '../store.jsx'
import DebtGraph from '../components/DebtGraph.jsx'
import { Logo } from '../components/ui.jsx'
import { simplify } from '../lib/settle.js'

// The story on this page: one weekend, five friends, nine debts.
const PEOPLE = [
  { id: 'a', name: 'Aarav', hue: '#9b8ac4' },
  { id: 'm', name: 'Meher', hue: '#f2a20c', onLight: true },
  { id: 'k', name: 'Kabir', hue: '#0e8c9b' },
  { id: 'z', name: 'Zoya', hue: '#c2317a' },
  { id: 'd', name: 'Dev', hue: '#8a5a44' },
]
const NINE = [
  ['k', 'a', 400], ['z', 'a', 350], ['d', 'a', 300], ['k', 'm', 250], ['m', 'd', 200],
  ['z', 'm', 250], ['a', 'd', 100], ['k', 'z', 100], ['a', 'k', 50],
].map(([from, to, r]) => ({ from, to, amount: r * 100 }))
const NET = { a: 90000, m: 30000, k: -70000, z: -50000, d: 0 }
const THREE = simplify(NET)

export default function Landing() {
  const { login, register } = useStore()
  const [untangled, setUntangled] = useState(false)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') await login(form.email, form.password)
      else await register(form.name, form.email, form.password)
    } catch (err) { setError(err.message) }
  }

  return (
    <div className="landing">
      <section className="landing-story">
        <span className="wordmark"><Logo size={32} />SplitEase</span>
        <h1>Five friends, nine debts, three payments.</h1>
        <p className="landing-lede">
          SplitEase remembers who paid for what, then works out the fewest payments that leave everyone square.
        </p>
        <div className="demo">
          <DebtGraph members={PEOPLE} raw={NINE} clean={THREE} simplified={untangled}
            label={untangled ? 'Three payments settle all five friends' : 'Nine separate debts between five friends'} />
          <div className="demo-side">
            <p className="demo-count" aria-live="polite">{untangled ? 'Three payments. Dev owes nothing.' : 'Nine debts after one weekend.'}</p>
            <button className="btn" onClick={() => setUntangled(!untangled)}>{untangled ? 'Show the nine debts' : 'Untangle them'}</button>
          </div>
        </div>
      </section>

      <section className="landing-auth">
        <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === 'register' && (
            <label className="field"><span>Name</span>
              <input className="input" value={form.name} onChange={set('name')} autoComplete="name" />
            </label>
          )}
          <label className="field"><span>Email</span>
            <input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </label>
          <label className="field"><span>Password</span>
            <input className="input" type="password" value={form.password} onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </label>
          {error && <p className="error" role="alert" style={{ color: '#ff9cc8' }}>{error}</p>}
          <button className="btn btn-primary">{mode === 'login' ? 'Log in' : 'Create account'}</button>
        </form>
        <p className="soft">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button className="linkish" style={{ color: 'inherit' }} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
        <p className="soft small">
          Want to look around first?{' '}
          <button className="linkish" style={{ color: 'inherit' }} onClick={() => login('taha@example.com', 'sample')}>Open the sample account</button>
        </p>
      </section>
    </div>
  )
}
