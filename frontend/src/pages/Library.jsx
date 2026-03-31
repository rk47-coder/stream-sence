import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/useAuth'
import { useVideoSocket } from '../hooks/useVideoSocket'
import { formatBytes, formatDuration } from '../lib/format'
import { posterGradient } from '../lib/poster'

function StatusBadge({ status }) {
  const styles = {
    pending: 'border-amber-200 bg-amber-50 text-amber-900',
    processing: 'border-sky-200 bg-sky-50 text-sky-900',
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    failed: 'border-rose-200 bg-rose-50 text-rose-900',
  }
  return <span className={`badge border ${styles[status] || 'border-zinc-200 text-zinc-600'}`}>{status}</span>
}

function SensitivityBadge({ s }) {
  const styles = {
    unknown: 'text-zinc-500',
    safe: 'text-emerald-400',
    flagged: 'text-rose-400',
  }
  return <span className={`text-[11px] font-bold uppercase tracking-wider ${styles[s] || ''}`}>{s}</span>
}

export default function Library() {
  const { token, canUpload } = useAuth()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filters, setFilters] = useState({ status: '', sensitivity: '', search: '' })

  const load = useCallback(async () => {
    setErr('')
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.sensitivity) params.set('sensitivity', filters.sensitivity)
      if (filters.search) params.set('search', filters.search)
      const q = params.toString()
      const { data } = await api.get(`/api/videos${q ? `?${q}` : ''}`)
      setVideos(data.videos || [])
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to load videos')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  useVideoSocket(
    token,
    useCallback((p) => {
      setVideos((prev) =>
        prev.map((v) =>
          v._id === p.videoId
            ? {
                ...v,
                progress: p.progress ?? v.progress,
                status: p.status ?? v.status,
                sensitivity: p.sensitivity ?? v.sensitivity,
                sensitivityReason: p.sensitivityReason ?? v.sensitivityReason,
                processingError: p.processingError ?? v.processingError,
              }
            : v
        )
      )
    }, [])
  )

  const activeJobs = useMemo(
    () => videos.filter((v) => v.status === 'processing' || v.status === 'pending').length,
    [videos]
  )

  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Library</h1>
          <p className="mt-1 max-w-xl text-zinc-500">Filter by pipeline state or safety. Tiles update live while jobs run.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpload && (
            <Link to="/upload" className="btn-primary">
              Upload video
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              load()
            }}
            className="btn-secondary"
          >
            Refresh
          </button>
        </div>
      </div>

      {activeJobs > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-40" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-400" />
          </span>
          <p className="text-sm text-teal-900/90">
            <span className="font-semibold text-teal-800">{activeJobs}</span> job{activeJobs > 1 ? 's' : ''} in flight — listening on Socket.io
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-4 rounded-2xl border border-zinc-200/90 bg-white/60 p-5 sm:grid-cols-3">
        <div>
          <label className="label">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="field !py-2.5"
          >
            <option value="">Any</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="ready">Ready</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div>
          <label className="label">Sensitivity</label>
          <select
            value={filters.sensitivity}
            onChange={(e) => setFilters((f) => ({ ...f, sensitivity: e.target.value }))}
            className="field !py-2.5"
          >
            <option value="">Any</option>
            <option value="unknown">Unknown</option>
            <option value="safe">Safe</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>
        <div>
          <label className="label">Search title</label>
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Partial match…"
            className="field !py-2.5"
          />
        </div>
      </div>

      {err && <p className="mt-6 text-sm text-rose-400">{err}</p>}
      {loading && <p className="mt-10 font-mono text-sm text-zinc-500">Fetching…</p>}

      {!loading && videos.length === 0 && (
        <div className="surface mt-10 p-12 text-center">
          <p className="text-zinc-400">Nothing here yet. {canUpload ? 'Upload a clip to get started.' : 'Ask your editor to share a video.'}</p>
        </div>
      )}

      <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map((v) => (
          <li key={v._id}>
            <Link
              to={`/video/${v._id}`}
              className="group surface block overflow-hidden transition hover:-translate-y-0.5 hover:border-teal-400/20 hover:shadow-lg hover:shadow-teal-500/5"
            >
              <div className="relative aspect-video overflow-hidden" style={posterGradient(v.title)}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                  <StatusBadge status={v.status} />
                  <SensitivityBadge s={v.sensitivity} />
                </div>
                {(v.status === 'processing' || v.status === 'pending') && (
                  <div className="absolute left-3 right-3 top-3">
                    <div className="h-1 overflow-hidden rounded-full bg-black/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all duration-300"
                        style={{ width: `${v.progress ?? 0}%` }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[10px] text-white/80">{v.progress ?? 0}%</p>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h2 className="line-clamp-2 font-semibold text-zinc-900 group-hover:text-teal-700">{v.title}</h2>
                <p className="mt-2 font-mono text-[11px] text-zinc-500">
                  {formatBytes(v.sizeBytes)} · {formatDuration(v.durationSeconds)}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-600">{v.originalName}</p>
                {v.status === 'failed' && v.processingError && (
                  <p className="mt-2 line-clamp-2 text-xs text-rose-400">{v.processingError}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
