import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    organizationName: '',
  })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setPending(true)
    try {
      await register(form)
      navigate('/', { replace: true })
    } catch (err) {
      const errs = err.response?.data?.errors
      if (errs?.length) setError(errs.map((x) => x.msg).join(', '))
      else setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="surface-strong p-8 sm:p-10">
      <h2 className="text-2xl font-bold text-zinc-900">Create workspace</h2>
      <p className="mt-1 text-sm text-zinc-500">You&apos;ll be admin for this tenant.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
        )}
        <div>
          <label className="label">Organisation</label>
          <input
            required
            value={form.organizationName}
            onChange={(e) => setForm((f) => ({ ...f, organizationName: e.target.value }))}
            className="field"
            placeholder="Acme Media"
          />
        </div>
        <div>
          <label className="label">Your name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="field"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="field"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="field"
            autoComplete="new-password"
            placeholder="8+ characters"
          />
        </div>
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Already invited?{' '}
        <Link to="/login" className="link-teal">
          Sign in
        </Link>
      </p>
    </div>
  )
}
