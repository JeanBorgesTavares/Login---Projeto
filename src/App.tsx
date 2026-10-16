/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import Layout from '@/components/Layout'
import Index from '@/pages/Index'
import SignUp from '@/pages/SignUp'
import ForgotPassword from '@/pages/ForgotPassword'
import Dashboard from '@/pages/Dashboard'
import ConnectionTest from '@/pages/ConnectionTest'
import Onboarding from '@/pages/Onboarding'
import CompanyRequest from '@/pages/CompanyRequest'
import DriverRequest from '@/pages/DriverRequest'
import NotFound from '@/pages/NotFound'

// F1-007: guard da rota /company-request — exige sessão + perfil company/pending.
const CompanyRequestGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth()
  if (loading) {
    return null
  }
  if (!user || profile?.role !== 'company' || profile?.status !== 'pending') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

// F1-009: guard da rota /driver-request — sessão + perfil driver/pending.
const DriverRequestGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth()
  if (loading) {
    return null
  }
  if (!user || profile?.role !== 'driver' || profile?.status !== 'pending') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/connection-test" element={<ConnectionTest />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route
              path="/company-request"
              element={
                <CompanyRequestGuard>
                  <CompanyRequest />
                </CompanyRequestGuard>
              }
            />
            <Route
              path="/driver-request"
              element={
                <DriverRequestGuard>
                  <DriverRequest />
                </DriverRequestGuard>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
