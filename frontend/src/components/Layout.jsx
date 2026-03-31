import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function NavItem({ to, end, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative rounded-xl px-4 py-2 text-sm font-medium transition ${
          isActive ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/10 ring-1 ring-teal-400/25" />
          )}
          <span className="relative">{children}</span>
        </>
      )}
    </NavLink>
  )
}

export default function Layout() {
  const { user, tenant, logout, isAdmin, canUpload } = useAuth()

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-zinc-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-sm font-bold text-zinc-950 shadow-lg shadow-teal-500/20">
                S
              </span>
              StreamSense
            </Link>
            <nav className="flex flex-wrap items-center gap-1">
              <NavItem to="/" end>
                Library
              </NavItem>
              {canUpload && <NavItem to="/upload">Upload</NavItem>}
              {isAdmin && <NavItem to="/team">Team</NavItem>}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-zinc-900">{user?.name || user?.email}</p>
              <p className="font-mono text-[11px] text-zinc-500">{tenant?.name}</p>
            </div>
            <span className="badge border border-zinc-200 bg-zinc-100 text-zinc-600">{user?.role}</span>
            <button type="button" onClick={logout} className="btn-secondary !py-2 !text-xs">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
