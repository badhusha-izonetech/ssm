import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import companyLogoAsset from '../assets/company_logo.png'
import loginDesktopAsset from '../assets/login_page_desktop.png'
import loginPhoneAsset from '../assets/login_page_phone.png'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Enter username and password.')
      return
    }
    const result = await login(username, password)
    if (!result.ok) {
      setError(result.error ?? 'Login failed.')
      return
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden flex items-center justify-center">
      {/* Desktop / Tablet Visual Background (768px and up) */}
      <div
        className="hidden md:block absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url(${loginDesktopAsset})` }}
        aria-hidden="true"
      />

      {/* Mobile Visual Background (320px - 767px) */}
      <div
        className="block md:hidden absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: `url(${loginPhoneAsset})` }}
        aria-hidden="true"
      />

      {/* Background black shade gradient from left to right */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* Login Page Container: Left Brand Showcase + Right Login Card */}
      <div className="relative z-10 w-full min-h-screen flex flex-col md:flex-row items-center justify-center md:justify-between px-5 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-8 sm:py-12 gap-8 lg:gap-12">
        {/* Left Side: Company Logo, Styled Company Name & Slogan (Desktop & Tablet) */}
        <div className="hidden md:flex flex-col justify-center max-w-md lg:max-w-lg xl:max-w-xl text-left z-10">
          <div className="space-y-6">
              {/* Company Logo with frosted white badge for maximum brand contrast */}
              <div className="inline-flex items-center p-2.5 px-4 rounded-2xl bg-white/95 backdrop-blur-md shadow-md">
                <img
                  src={companyLogoAsset}
                  alt="Success Solar Power Care"
                  className="h-12 lg:h-14 w-auto object-contain drop-shadow-xs"
                />
              </div>

              {/* Styled Company Name */}
              <div className="space-y-2">
                <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl xl:text-5xl text-white tracking-tight leading-[1.15] drop-shadow-md">
                  Success Solar <span className="text-[#22c55e]">Power Care</span>
                </h1>
              </div>

              {/* Slogan with high-end styling */}
              <div className="pt-4 border-t border-white/20">
                <div className="border-l-4 border-[#22c55e] pl-4 py-1">
                  <p className="text-sm sm:text-base lg:text-lg font-medium text-slate-100 leading-relaxed italic drop-shadow-sm">
                    “Power Your World with Sunshine – Reliable Solar Panel Solutions for a Brighter Future!”
                  </p>
                </div>
              </div>
            </div>
        </div>

        {/* Right Side: Main Login Card */}
        <div className="w-full max-w-[400px] sm:max-w-[430px] shrink-0">
          <div className="bg-white/95 backdrop-blur-md border border-white/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-950/20">
            {/* Branding Header inside Login Card */}
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="py-2.5 px-4 rounded-2xl bg-white border border-slate-200/70 shadow-xs flex items-center justify-center mb-3">
                <img
                  src={companyLogoAsset}
                  alt="Success Solar Power Care"
                  className="h-9 sm:h-11 w-auto object-contain"
                />
              </div>
              <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 tracking-tight">
                Success Solar Power Care
              </h2>

            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="text-[11px] uppercase tracking-wider text-slate-700 font-bold block mb-1.5 flex items-center gap-1.5"
                >
                  <User size={13} className="text-emerald-600 shrink-0" /> Username
                </label>
                <div className="relative">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. divya.shankar"
                    autoComplete="username"
                    required
                    className="w-full h-11 sm:h-12 bg-slate-50/90 hover:bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="text-[11px] uppercase tracking-wider text-slate-700 font-bold block mb-1.5 flex items-center gap-1.5"
                >
                  <Lock size={13} className="text-emerald-600 shrink-0" /> Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full h-11 sm:h-12 bg-slate-50/90 hover:bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-11 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 active:text-emerald-700 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 font-medium"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#16a34a] hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl h-11 sm:h-12 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                Sign in
              </button>
            </form>


          </div>
        </div>
      </div>
    </div>
  )
}
