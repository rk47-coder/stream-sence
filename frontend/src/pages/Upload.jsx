import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'

export default function Upload() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')
  const [pending, setPending] = useState(false)
  const [drag, setDrag] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (!file) {
      setErr('Pick a video file first')
      return
    }
    setErr('')
    setPending(true)
    setProgress(0)

    const fd = new FormData()
    fd.append('video', file)
    if (title.trim()) fd.append('title', title.trim())
    if (description.trim()) fd.append('description', description.trim())

    try {
      const { data } = await api.post('/api/videos', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (!ev.total) return
          setProgress(Math.round((ev.loaded * 100) / ev.total))
        },
      })
      navigate(`/video/${data.video._id}`, { replace: true })
    } catch (ex) {
      setErr(ex.response?.data?.error || 'Upload failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-bold text-zinc-900">Upload</h1>
      <p className="mt-1 text-zinc-500">MP4, WebM, MOV, AVI, MKV. Server runs sensitivity pass after upload.</p>

      <form onSubmit={onSubmit} className="mt-10 space-y-6">
        {err && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</p>
        )}

        <div
          className={`surface cursor-pointer border-2 border-dashed px-6 py-14 text-center transition ${
            drag ? 'border-teal-400/60 bg-teal-50/80' : 'border-zinc-200 hover:border-zinc-300'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            const f = e.dataTransfer.files?.[0]
            if (f?.type.startsWith('video/')) setFile(f)
          }}
        >
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="file"
          />
          <label htmlFor="file" className="cursor-pointer">
            <p className="text-sm font-medium text-zinc-800">Drop file here or browse</p>
            <p className="mt-2 font-mono text-xs text-zinc-500">Max size set on server (see MAX_VIDEO_SIZE_MB)</p>
          </label>
          {file && <p className="mt-4 truncate font-mono text-sm text-teal-700">{file.name}</p>}
        </div>

        <div>
          <label className="label">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="field" placeholder="Defaults to filename" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="field min-h-[100px] resize-y"
          />
        </div>

        {pending && (
          <div className="surface p-4">
            <div className="mb-2 flex justify-between font-mono text-xs text-zinc-500">
              <span>Uploading</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? 'Uploading…' : 'Start upload'}
        </button>
      </form>
    </div>
  )
}
