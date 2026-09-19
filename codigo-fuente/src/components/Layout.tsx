import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Ban, BarChart3, Boxes, History, LayoutDashboard, LogOut, Menu, Package, PackagePlus, Receipt,
  Settings as SettingsIcon, ShoppingCart, Tags, UserCircle, Users, X, type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { ROLE_LABEL } from '../lib/format'
import type { Role } from '../lib/types'

interface NavItem { to: string; label: string; vendedorLabel?: string; icon: LucideIcon; roles: Role[] }
interface NavGroup { title?: string; items: NavItem[] }

const ALL: Role[] = ['admin', 'vendedor', 'consulta']
const STAFF: Role[] = ['admin', 'vendedor']

const GROUPS: NavGroup[] = [
  { items: [{ to: '/', label: 'Inicio', icon: LayoutDashboard, roles: ALL }] },
  {
    title: 'Inventario',
    items: [
      { to: '/productos', label: 'Productos', icon: Package, roles: ALL },
      { to: '/categorias', label: 'Categorías', icon: Tags, roles: ALL },
      { to: '/ingreso', label: 'Ingreso de mercadería', icon: PackagePlus, roles: STAFF },
      { to: '/movimientos', label: 'Movimientos', icon: History, roles: STAFF },
    ],
  },
  {
    title: 'Ventas',
    items: [
      { to: '/ventas/nueva', label: 'Nueva venta', icon: ShoppingCart, roles: STAFF },
      { to: '/ventas', label: 'Ventas', vendedorLabel: 'Mis ventas', icon: Receipt, roles: STAFF },
      { to: '/ventas?estado=anulada', label: 'Anulaciones', icon: Ban, roles: ['admin'] },
    ],
  },
  { items: [{ to: '/reportes', label: 'Reportes', icon: BarChart3, roles: ALL }] },
  {
    title: 'Administración',
    items: [
      { to: '/usuarios', label: 'Usuarios', icon: Users, roles: ['admin'] },
      { to: '/configuracion', label: 'Configuración', icon: SettingsIcon, roles: ['admin'] },
    ],
  },
  { items: [{ to: '/perfil', label: 'Mi perfil', icon: UserCircle, roles: ALL }] },
]

function isActive(to: string, pathname: string, search: string): boolean {
  const [p, s] = to.split('?')
  if (s) return pathname === p && search.includes(s)
  if (p === '/') return pathname === '/'
  if (p === '/ventas') {
    return (pathname === '/ventas' && !search.includes('estado=anulada')) ||
      (pathname.startsWith('/ventas/') && pathname !== '/ventas/nueva')
  }
  return pathname === p || pathname.startsWith(p + '/')
}

function NavList({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const { pathname, search } = useLocation()
  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Menú principal">
      {GROUPS.map((g, gi) => {
        const items = g.items.filter((i) => i.roles.includes(role))
        if (items.length === 0) return null
        return (
          <div key={gi} className={g.title ? 'mt-5' : 'mt-1'}>
            {g.title && <p className="mb-1 px-3 text-[13px] font-semibold text-white/50">{g.title}</p>}
            {items.map((i) => {
              const active = isActive(i.to, pathname, search)
              const Icon = i.icon
              return (
                <Link
                  key={i.to}
                  to={i.to}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors ${
                    active ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-etiqueta" />}
                  <Icon className="h-5 w-5 shrink-0" />
                  {role === 'vendedor' && i.vendedorLabel ? i.vendedorLabel : i.label}
                </Link>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}

function Brand({ name }: { name: string }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-5 py-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-etiqueta text-tinta"><Boxes className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block truncate font-display text-[17px] font-bold leading-tight text-white">{name}</span>
        <span className="block text-[13px] text-white/60">Inventario y ventas</span>
      </span>
    </Link>
  )
}

function UserBox() {
  const { profile, signOut } = useAuth()
  if (!profile) return null
  return (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-[15px] font-semibold text-white">{profile.full_name || profile.email}</p>
      <p className="text-[13px] text-white/60">{ROLE_LABEL[profile.role]}</p>
      <button onClick={signOut} className="mt-3 flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 text-[15px] font-medium text-white/80 hover:bg-white/10">
        <LogOut className="h-5 w-5" /> Cerrar sesión
      </button>
    </div>
  )
}

export default function Layout() {
  const { profile } = useAuth()
  const { settings } = useSettings()
  const { pathname } = useLocation()
  const [drawer, setDrawer] = useState(false)
  const role = profile!.role
  const staff = role === 'admin' || role === 'vendedor'

  useEffect(() => { setDrawer(false); window.scrollTo(0, 0) }, [pathname])

  const tabs: { to: string; label: string; icon: LucideIcon; primary?: boolean }[] = staff
    ? [
        { to: '/', label: 'Inicio', icon: LayoutDashboard },
        { to: '/productos', label: 'Productos', icon: Package },
        { to: '/ventas/nueva', label: 'Vender', icon: ShoppingCart, primary: true },
        { to: '/ventas', label: role === 'vendedor' ? 'Mis ventas' : 'Ventas', icon: Receipt },
      ]
    : [
        { to: '/', label: 'Inicio', icon: LayoutDashboard },
        { to: '/productos', label: 'Productos', icon: Package },
        { to: '/categorias', label: 'Categorías', icon: Tags },
        { to: '/reportes', label: 'Reportes', icon: BarChart3 },
      ]

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-pino-deep lg:flex">
        <Brand name={settings.business_name} />
        <NavList role={role} />
        <UserBox />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between bg-pino-deep px-4 pt-[env(safe-area-inset-top)] lg:hidden">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-etiqueta text-tinta"><Boxes className="h-4 w-4" /></span>
            <span className="truncate font-display text-base font-bold text-white">{settings.business_name}</span>
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-28 lg:px-8 lg:py-8 lg:pb-10">
          <Outlet />
        </main>

        <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Accesos rápidos">
          <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
            {tabs.map((t) => {
              const active = isActive(t.to, pathname, '')
              const Icon = t.icon
              if (t.primary) {
                return (
                  <Link key={t.to} to={t.to} className="flex flex-col items-center pb-1.5" aria-label={t.label}>
                    <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-etiqueta text-tinta shadow-lg ring-4 ring-white"><Icon className="h-6 w-6" /></span>
                    <span className="mt-0.5 text-[12px] font-semibold text-tinta">{t.label}</span>
                  </Link>
                )
              }
              return (
                <Link key={t.to} to={t.to} aria-current={active ? 'page' : undefined} className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[12px] font-semibold ${active ? 'text-pino' : 'text-tinta-soft'}`}>
                  <Icon className="h-6 w-6" />
                  {t.label}
                </Link>
              )
            })}
            <button onClick={() => setDrawer(true)} className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[12px] font-semibold text-tinta-soft" aria-label="Abrir menú completo">
              <Menu className="h-6 w-6" />
              Más
            </button>
          </div>
        </nav>
      </div>

      {drawer && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <div className="absolute inset-0 bg-tinta/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col bg-pino-deep pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between pr-3">
              <Brand name={settings.business_name} />
              <button onClick={() => setDrawer(false)} aria-label="Cerrar menú" className="rounded-lg p-2 text-white/80 hover:bg-white/10"><X className="h-6 w-6" /></button>
            </div>
            <NavList role={role} onNavigate={() => setDrawer(false)} />
            <UserBox />
          </div>
        </div>
      )}
    </div>
  )
}
