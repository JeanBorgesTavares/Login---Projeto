import { Outlet, Link } from 'react-router-dom'
import FuelPumpSilhouette from './FuelPumpSilhouette'
import BrandLogo from './BrandLogo'

export default function Layout() {
  const currentYear = new Date().getFullYear()

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0A0A0A] text-[#F7F9F8] flex flex-col justify-between selection:bg-[#16A34A] selection:text-white">
      {/* Dynamic 135deg Gradient Background from #0A0A0A to #0B3D2E */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-br from-[#0A0A0A] via-[#081f18] to-[#0B3D2E]"
        aria-hidden="true"
      />

      {/* Subtle diagonal stripes pattern with slow scroll animation (evoking highway lanes) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-road-pattern opacity-40 mix-blend-screen"
        aria-hidden="true"
      />

      {/* Soft radial ambient glow */}
      <div
        className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-[#16A34A]/10 blur-[140px] z-0"
        aria-hidden="true"
      />

      {/* Desktop blurred fuel pump silhouette vignette on the right (hidden on mobile <= 640px) */}
      <div
        className="pointer-events-none fixed right-[-60px] top-1/2 -translate-y-1/2 hidden md:block lg:right-[-20px] xl:right-10 z-0 opacity-20 lg:opacity-25 filter blur-[1px] select-none"
        aria-hidden="true"
      >
        <FuelPumpSilhouette />
      </div>

      {/* Brand Header */}
      <header className="relative z-10 w-full pt-6 pb-2 px-6 flex items-center justify-center">
        <Link
          to="/"
          aria-label="Ir para a página inicial do Posto Comboio"
          className="group inline-flex items-center gap-3 transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] rounded-xl p-1"
        >
          <BrandLogo />
          <div className="flex flex-col text-left">
            <span className="font-extrabold text-xl sm:text-2xl tracking-tight text-[#F7F9F8] group-hover:text-white transition-colors leading-none">
              POSTO <span className="text-[#16A34A]">COMBOIO</span>
            </span>
            <span className="text-[11px] font-medium tracking-wider text-[#8B9A97] uppercase mt-1">
              Sistema de Cadastro
            </span>
          </div>
        </Link>
      </header>

      {/* Main Content Area: Centered container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        <Outlet />
      </main>

      {/* Minimalist Footer */}
      <footer className="relative z-10 w-full py-6 px-6 border-t border-white/[0.05] bg-[#0A0A0A]/40 backdrop-blur-sm text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#8B9A97]">
          <p className="font-medium text-[#F7F9F8]/80 text-xs sm:text-sm tracking-wide">
            Energia que move você
          </p>
          <p className="text-xs text-[#8B9A97]">
            © {currentYear} Posto Comboio. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
