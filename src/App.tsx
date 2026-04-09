import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

const Login = lazy(() => import('@/pages/Login'))
const Upload = lazy(() => import('@/pages/Upload'))
const Reports = lazy(() => import('@/pages/Reports'))
const ReportReview = lazy(() => import('@/pages/ReportReview'))
const ExtractionReview = lazy(() => import('@/pages/ExtractionReview'))
const SummaryBuilder = lazy(() => import('@/pages/SummaryBuilder'))
const PriceCheck = lazy(() => import('@/pages/PriceCheck'))
const Library = lazy(() => import('@/pages/admin/Library'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function Loading() {
  return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading...</div>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const { pathname } = useLocation()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <a
      href={href}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
        active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {children}
    </a>
  )
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="border-b bg-white px-6 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <a href="/reports" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">SRC</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Report Proofer</span>
          </a>
          <nav className="flex gap-0.5 ml-2">
            <NavLink href="/upload">Upload</NavLink>
            <NavLink href="/reports">Reports</NavLink>
            <NavLink href="/price-check">Price Check</NavLink>
            <NavLink href="/admin/library">Library</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{profile?.full_name || profile?.email}</span>
          <button
            onClick={signOut}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Navigate to="/reports" replace /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute><AppLayout><Upload /></AppLayout></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
              <Route path="/reports/:id" element={<ProtectedRoute><AppLayout><ReportReview /></AppLayout></ProtectedRoute>} />
              <Route path="/reports/:id/review" element={<ProtectedRoute><AppLayout><ExtractionReview /></AppLayout></ProtectedRoute>} />
              <Route path="/reports/:id/summary" element={<ProtectedRoute><AppLayout><SummaryBuilder /></AppLayout></ProtectedRoute>} />
              <Route path="/price-check" element={<ProtectedRoute><AppLayout><PriceCheck /></AppLayout></ProtectedRoute>} />
              <Route path="/admin/library" element={<ProtectedRoute><AppLayout><Library /></AppLayout></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
