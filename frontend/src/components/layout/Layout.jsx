import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <div className="bcml-backdrop d-lg-none" onClick={() => setSidebarOpen(false)} />}
      <div className="bcml-content">
        <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="p-3 p-lg-4 flex-grow-1">
          <div className="page-anim" key={location.pathname}>
            <Outlet />
          </div>
        </main>
        <footer className="text-center text-muted small py-3 border-top no-print">
          © {new Date().getFullYear()} Brilliant Construction and Materials Ltd
        </footer>
      </div>
    </>
  )
}
