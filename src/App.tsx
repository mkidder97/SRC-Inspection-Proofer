import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'

const Login = lazy(() => import('@/pages/Login'))
const Upload = lazy(() => import('@/pages/Upload'))
const Reports = lazy(() => import('@/pages/Reports'))
const ReportReview = lazy(() => import('@/pages/ReportReview'))
const Library = lazy(() => import('@/pages/admin/Library'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RoleRedirect() {
  const { role, loading } = useAuth()
  if (loading) return <PageLoader />
  if (role === 'admin') return <Navigate to="/admin/library" replace />
  return <Navigate to="/reports" replace />
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-primary">SRC Report Proofer</h1>
          <nav className="flex gap-1 ml-6">
            <a
              href="/upload"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
            >
              Upload
            </a>
            <a
              href="/reports"
              className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
            >
              Reports
            </a>
            {profile?.role === 'admin' && (
              <a
                href="/admin/library"
                className="px-3 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
              >
                Library
              </a>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.full_name || profile?.email}</span>
          <button
            onClick={signOut}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <RoleRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Upload />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Reports />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ReportReview />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/library"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Library />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
