import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import AuthShell from './components/AuthShell'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Library from './pages/Library'
import Upload from './pages/Upload'
import VideoDetail from './pages/VideoDetail'
import TeamAdmin from './pages/TeamAdmin'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthShell subtitle="Sign in to your organisation workspace.">
                <Login />
              </AuthShell>
            }
          />
          <Route
            path="/register"
            element={
              <AuthShell subtitle="Create a tenant and become its admin. Invite editors and viewers from Team after signup.">
                <Register />
              </AuthShell>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Library />} />
            <Route
              path="upload"
              element={
                <ProtectedRoute editorOnly>
                  <Upload />
                </ProtectedRoute>
              }
            />
            <Route path="video/:id" element={<VideoDetail />} />
            <Route
              path="team"
              element={
                <ProtectedRoute adminOnly>
                  <TeamAdmin />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
