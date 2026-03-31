import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/useAuth'
import { useVideoSocket } from '../hooks/useVideoSocket'
import { formatBytes, formatDuration } from '../lib/format'
import { posterGradient } from '../lib/poster'

function apiOrigin() {
  const b = import.meta.env.VITE_API_URL?.trim()
  if (b) return b.replace(/\/$/, '')
  return ''
}

function idStr(x) {
  if (x == null) return ''
  return typeof x === 'object' && x._id != null ? String(x._id) : String(x)
}

export default function VideoDetail() {
  const { id } = useParams()
  const { token, canUpload } = useAuth()
  const [video, setVideo] = useState(null)
  const [users, setUsers] = useState([])
  const [selectedViewers, setSelectedViewers] = useState([])
  const [err, setErr] = useState('')
  const [shareMsg, setShareMsg] = useState('')

  const load = useCallback(async () => {
    setErr('')
    try {
      const { data } = await api.get(`/api/videos/${id}`)
      setVideo(data.video)
    } catch (e) {
      setErr(e.response?.data?.error || 'Could not load video')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const shareSyncKey = useMemo(() => {
    if (!video?._id) return ''
    const ids = (video.sharedWith || []).map(idStr).slice().sort()
    return `${video._id}:${ids.join(',')}`
  }, [video?._id, video?.sharedWith])

  useEffect(() => {
    if (!video) return
    setSelectedViewers((video.sharedWith || []).map(idStr))
    // shareSyncKey already tracks _id + sharedWith; omit `video` so progress socket updates don't wipe checkbox edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareSyncKey])

  useVideoSocket(
    token,
    useCallback(
      (p) => {
        if (p.videoId === id) setVideo((v) => (v ? { ...v, ...p } : v))
      },
      [id]
    )
  )

  useEffect(() => {
    if (!canUpload) return
    ;(async () => {
      try {
        const { data } = await api.get('/api/users')
        setUsers(data.users || [])
      } catch {
        /* silent */
      }
    })()
  }, [canUpload])

  const streamSrc = useMemo(() => {
    if (!video || video.status !== 'ready' || !token) return ''
    const base = apiOrigin()
    return `${base}/api/videos/${video._id}/stream?token=${encodeURIComponent(token)}`
  }, [video, token])

  async function saveMeta(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    try {
      await api.patch(`/api/videos/${id}`, {
        title: fd.get('title'),
        description: fd.get('description'),
      })
      setShareMsg('Saved.')
      load()
    } catch (e) {
      setShareMsg(e.response?.data?.error || 'Save failed')
    }
  }

  async function shareWithViewers() {
    setShareMsg('')
    try {
      await api.post(`/api/videos/${id}/share`, { userIds: selectedViewers })
      setShareMsg('Sharing updated.')
      load()
    } catch (e) {
      setShareMsg(e.response?.data?.error || 'Share failed')
    }
  }

  async function removeVideo() {
    if (!confirm('Delete this video permanently?')) return
    try {
      await api.delete(`/api/videos/${id}`)
      window.location.href = '/'
    } catch (e) {
      setErr(e.response?.data?.error || 'Delete failed')
    }
  }

  if (err && !video) {
    return (
      <div className="surface p-8 text-center">
        <p className="text-rose-400">{err}</p>
        <Link to="/" className="link-teal mt-4 inline-block">
          Back to library
        </Link>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" />
        <p className="font-mono text-sm text-zinc-500">Loading…</p>
      </div>
    )
  }

  const viewers = users.filter((u) => u.role === 'viewer')

  return (
    <div>
      <Link to="/" className="mb-8 inline-flex items-center gap-2 font-mono text-sm text-zinc-500 transition hover:text-teal-400">
        <span aria-hidden>←</span> Library
      </Link>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">{video.title}</h1>
              <p className="mt-2 font-mono text-sm text-zinc-500">
                {formatBytes(video.sizeBytes)} · {formatDuration(video.durationSeconds)} ·{' '}
                <span className={video.sensitivity === 'flagged' ? 'text-rose-400' : 'text-zinc-400'}>{video.sensitivity}</span>
              </p>
            </div>
          </div>

          <div className="glow-ring mt-8 overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-900 ring-1 ring-zinc-400/20">
            {video.status === 'ready' && streamSrc ? (
              <video
                key={streamSrc}
                className="aspect-video w-full bg-black"
                controls
                playsInline
                preload="auto"
              >
                <source src={streamSrc} type={video.mimeType || 'video/mp4'} />
              </video>
            ) : (
              <div className="relative flex aspect-video items-center justify-center" style={posterGradient(video.title)}>
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-[1] max-w-sm px-6 text-center">
                  {video.status === 'processing' || video.status === 'pending' ? (
                    <>
                      <p className="text-lg font-medium text-white">Processing pipeline</p>
                      <p className="mt-1 font-mono text-sm text-zinc-400">{video.progress ?? 0}%</p>
                      <div className="mx-auto mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 transition-all"
                          style={{ width: `${video.progress ?? 0}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-zinc-300">Playback unavailable ({video.status})</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="surface mt-8 p-6">
            <h3 className="text-sm font-semibold text-zinc-900">Sensitivity result</h3>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-teal-400/90">{video.sensitivity}</p>
            {video.sensitivityReason && <p className="mt-3 text-sm leading-relaxed text-zinc-400">{video.sensitivityReason}</p>}
            {video.processingError && <p className="mt-3 text-sm text-rose-400">{video.processingError}</p>}
          </div>
        </div>

        <div className="space-y-6">
          {canUpload && (
            <form onSubmit={saveMeta} className="surface space-y-4 p-6">
              <h3 className="font-semibold text-zinc-900">Details</h3>
              <div>
                <label className="label">Title</label>
                <input name="title" defaultValue={video.title} className="field" />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea name="description" defaultValue={video.description} rows={4} className="field min-h-[100px] resize-y" />
              </div>
              <button type="submit" className="btn-secondary w-full">
                Save changes
              </button>
            </form>
          )}

          {canUpload && viewers.length > 0 && (
            <div className="surface p-6">
              <h3 className="font-semibold text-zinc-900">Viewers</h3>
              <p className="mt-1 text-xs text-zinc-500">Tick who can open this file (RBAC).</p>
              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1">
                {viewers.map((u) => {
                  const uid = idStr(u._id)
                  return (
                    <label key={uid} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-white/20 bg-black/40 text-teal-500 focus:ring-teal-400/40"
                        checked={selectedViewers.includes(uid)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedViewers((s) => [...s, uid])
                          else setSelectedViewers((s) => s.filter((x) => x !== uid))
                        }}
                      />
                      <span className="text-sm text-zinc-300">{u.email}</span>
                    </label>
                  )
                })}
              </div>
              <button type="button" onClick={shareWithViewers} className="btn-primary mt-4 w-full">
                Update sharing
              </button>
            </div>
          )}

          {shareMsg && <p className="text-center text-sm text-emerald-400">{shareMsg}</p>}

          {canUpload && (
            <button type="button" onClick={removeVideo} className="btn-danger">
              Delete video
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
