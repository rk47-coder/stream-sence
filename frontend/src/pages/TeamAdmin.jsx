import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function TeamAdmin() {
  const [users, setUsers] = useState([])
  const [err, setErr] = useState('')
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'editor' })

  async function load() {
    try {
      const { data } = await api.get('/api/users')
      setUsers(data.users || [])
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load team')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function invite(e) {
    e.preventDefault()
    setErr('')
    try {
      await api.post('/api/users', form)
      setForm({ email: '', password: '', name: '', role: 'editor' })
      load()
    } catch (e) {
      const errs = e.response?.data?.errors
      setErr(errs?.map((x) => x.msg).join(', ') || e.response?.data?.error || 'Invite failed')
    }
  }

  async function changeRole(userId, role) {
    try {
      await api.patch(`/api/users/${userId}/role`, { role })
      load()
    } catch (e) {
      setErr(e.response?.data?.error || 'Role update failed')
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-zinc-900">Team</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-500">
        Editors upload their own assets. Viewers need a share on each video. You stay on this tenant only.
      </p>

      {err && (
        <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</p>
      )}

      <div className="surface-strong mt-10 p-8">
        <h2 className="text-lg font-semibold text-zinc-900">Invite someone</h2>
        <form onSubmit={invite} className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="field"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="field"
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="field !py-2.5"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="field" />
          </div>
          <button type="submit" className="btn-primary sm:col-span-2">
            Create account
          </button>
        </form>
      </div>

      <ul className="mt-10 space-y-3">
        {users.map((u) => (
          <li key={u._id} className="surface flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-medium text-zinc-900">{u.email}</p>
              <p className="font-mono text-xs text-zinc-500">{u.name || '—'}</p>
            </div>
            <select
              value={u.role}
              onChange={(e) => changeRole(u._id, e.target.value)}
              className="field !w-auto !min-w-[140px] !py-2 font-mono text-sm"
            >
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}
