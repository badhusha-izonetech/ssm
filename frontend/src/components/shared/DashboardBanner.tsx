import type { ReactNode } from 'react'
import { useAuth, type PortalKey } from '../../auth/AuthContext'
import { getRoleBanner } from '../../lib/roleBanners'

export interface BannerStat {
  label: string
  value: string | number
}

export interface DashboardBannerProps {
  portal?: PortalKey
  title?: string
  subtitle?: string
  eyebrow?: string
  stats?: BannerStat[]
  action?: ReactNode
  className?: string
}

/**
 * Reusable Role-Based Dashboard Hero Banner Card
 * 
 * Displays the authenticated user's role-specific banner asset with responsive
 * framing (ensuring the role subject/person on the right is preserved across viewports).
 */
export function DashboardBanner({
  portal: propPortal,
  title,
  subtitle,
  eyebrow: _eyebrow,
  stats: _stats,
  action,
  className = '',
}: DashboardBannerProps) {
  const { employee, portal: authPortal } = useAuth()
  const activePortal = propPortal || authPortal

  const bannerImg = getRoleBanner(activePortal, employee?.designation)

  if (!bannerImg) {
    return null
  }

  const defaultTitle = `Hello, ${employee?.name?.split(' ')[0] ?? ''}`

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs w-full aspect-[2048/768] min-h-[200px] sm:min-h-[260px] md:min-h-[320px] flex items-center ${className}`}
    >
      {/* Role-specific background illustration fulfilling the exact aspect ratio */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src={bannerImg}
          alt={activePortal ? `${activePortal} Banner` : 'Role Dashboard Banner'}
          className="w-full h-full object-cover object-center select-none"
        />
      </div>

      {/* Delicate subtle scrim on the top-left preserving natural artwork vibrancy while ensuring text clarity */}
      <div className="absolute inset-0 z-0 bg-gradient-to-r from-white/40 via-white/15 to-transparent pointer-events-none max-w-md sm:max-w-lg" />

      {/* Text content positioned on the left scenic portion, elevated towards the top sky area */}
      <div className="relative z-10 w-full h-full p-6 sm:p-8 lg:p-10 flex flex-col justify-start pt-6 sm:pt-8 md:pt-10 lg:pt-12">
        <div className="max-w-md sm:max-w-lg space-y-1 sm:space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-slate-950 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]">
            {title || defaultTitle}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm lg:text-[15px] text-slate-800 font-semibold leading-relaxed drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
              {subtitle}
            </p>
          )}
          {action && <div className="pt-2">{action}</div>}
        </div>
      </div>
    </div>
  )
}
