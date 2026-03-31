import { Link } from 'react-router-dom'

export default function AuthShell({ children, subtitle }) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-100/50 lg:flex-row">
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden border-zinc-200/80 bg-zinc-200/35 px-8 py-10 lg:min-h-screen lg:max-w-[46%] lg:border-r lg:px-14 lg:py-14">
        <div className="auth-grid pointer-events-none absolute inset-0 opacity-80" />
        <div className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-teal-500/20 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-indigo-600/15 blur-[120px]" />

        <div className="relative z-[1]">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-sm font-bold text-zinc-950">
              S
            </span>
            StreamSense
          </Link>
        </div>

        <div className="relative z-[1] my-10 max-w-md lg:my-0">
          <h1 className="text-3xl font-bold leading-tight text-zinc-900 md:text-4xl">
            Upload, scan, stream — without losing the plot.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-600">
            {subtitle ||
              'Tenant-scoped library with live processing updates and role-based access. Built for coursework demos and small teams.'}
          </p>
          <ul className="mt-8 space-y-3 font-mono text-xs text-zinc-600">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              Socket.io progress + HTTP range playback
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              Admin · editor · viewer isolation
            </li>
          </ul>
        </div>

        <p className="relative z-[1] font-mono text-[11px] text-zinc-500">© {new Date().getFullYear()}</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 lg:py-0">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
