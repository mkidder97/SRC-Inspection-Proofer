import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

const Login = lazy(() => import('@/pages/Login'))
const Upload = lazy(() => import('@/pages/Upload'))
const Reports = lazy(() => import('@/pages/Reports'))
const ReportReview = lazy(() => import('@/pages/ReportReview'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function Loading() {
  return <div style={{ padding: '2rem', color: '#737373' }}>Loading...</div>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold" style={{ color: 'var(--primary)' }}>SRC Report Proofer</h1>
          <nav className="flex gap-1">
            <a href="/upload" className="px-3 py-1.5 text-sm rounded-md hover:bg-gray-100">Upload</a>
            <a href="/reports" className="px-3 py-1.5 text-sm rounded-md hover:bg-gray-100">Reports</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.full_name || profile?.email}</span>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
