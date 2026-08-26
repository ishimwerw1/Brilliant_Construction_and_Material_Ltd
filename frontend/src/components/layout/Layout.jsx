// Layout.jsx
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="d-flex flex-column min-vh-100 bg-light position-relative overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <div className="bcml-backdrop d-lg-none" onClick={() => setSidebarOpen(false)} />}
      <div className="bcml-content d-flex flex-column min-vh-100 flex-grow-1 overflow-x-hidden">
        <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="p-2 p-sm-3 p-md-4 flex-grow-1 w-100">
          <div className="page-anim w-100" key={location.pathname}>
            <Outlet />
          </div>
        </main>
        <footer className="text-center text-muted small py-3 px-3 border-top no-print mt-auto bg-white">
          © {new Date().getFullYear()} Brilliant Construction and Materials Ltd
        </footer>
      </div>
    </div>
  )
}