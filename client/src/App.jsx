import { useCallback, useEffect, useMemo, useState } from 'react'
import CustomerHome from './pages/CustomerHome.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import SellerPanel from './pages/SellerPanel.jsx'
import SellerRegisterPage from './pages/SellerRegisterPage.jsx'
import RiderHub from './pages/RiderHub.jsx'
import FranchisePanel from './pages/FranchisePanel.jsx'
import FranchisePage from './pages/FranchisePage.jsx'
import LoginPage, { viewForRole } from './pages/LoginPage.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { usePlatform } from './context/PlatformContext.jsx'

const LAST_PANEL_KEY = 'japto_last_panel_view'
/** Staff panels: Admin / Seller shop / Rider / Franchise (+ customer storefront separately) */
const STAFF_VIEWS = ['seller', 'superadmin', 'rider', 'franchise']

function normalizeView(view) {
  // Old StoreAdmin / Category Ops → single Admin Panel
  if (view === 'platform_ops' || view === 'admin' || view === 'store_admin') return 'superadmin'
  return view
}

function canAccessView(user, view) {
  if (!user) return false
  const v = normalizeView(view)
  if (v === 'superadmin') return user.role === 'superadmin'
  if (v === 'seller') return user.role === 'store_owner'
  if (v === 'rider') return user.role === 'driver' || user.role === 'superadmin'
  if (v === 'franchise') return user.role === 'franchise' || user.role === 'superadmin'
  return true
}

/** Only restore a saved panel if it belongs to this role */
function allowedPanelForRole(role, panelView) {
  const v = normalizeView(panelView)
  if (role === 'store_owner') return v === 'seller' ? v : null
  if (role === 'driver') return v === 'rider' ? v : null
  if (role === 'franchise') return v === 'franchise' ? v : null
  if (role === 'superadmin') return v === 'superadmin' ? v : null
  return null
}

function panelLabelFor(view, role) {
  const v = normalizeView(view)
  if (role === 'customer') return '👤 My Account'
  if (v === 'seller' || role === 'store_owner') return '🏪 Seller Panel'
  if (v === 'rider' || role === 'driver') return '🛵 Rider Hub'
  if (v === 'franchise' || role === 'franchise') return '🗺️ Franchise Panel'
  if (v === 'superadmin' || role === 'superadmin') return '👑 Admin Panel'
  return null
}

function readLastPanel() {
  try {
    return sessionStorage.getItem(LAST_PANEL_KEY) || ''
  } catch {
    return ''
  }
}

function writeLastPanel(v) {
  try {
    if (v) sessionStorage.setItem(LAST_PANEL_KEY, v)
  } catch {
    /* ignore */
  }
}

function clearLastPanel() {
  try {
    sessionStorage.removeItem(LAST_PANEL_KEY)
  } catch {
    /* ignore */
  }
}

function App() {
  const { view: rawView, setView, refreshAdminQueues, refreshCatalog } = usePlatform()
  const view = normalizeView(rawView)
  const { user, isAuthenticated, loading, logout } = useAuth()
  const [loginIntent, setLoginIntent] = useState('customer')
  const [lastPanel, setLastPanel] = useState(() => readLastPanel())

  const rememberPanel = useCallback((panelView) => {
    const v = normalizeView(panelView)
    if (STAFF_VIEWS.includes(v)) {
      writeLastPanel(v)
      setLastPanel(v)
    }
  }, [])

  const goStorefront = useCallback(() => {
    if (STAFF_VIEWS.includes(view)) {
      rememberPanel(view)
    }
    setView('customer')
  }, [setView, view, rememberPanel])

  const goDashboard = useCallback(() => {
    if (!user) return

    // Customer stays on storefront — My Account is handled inside CustomerHome
    if (user.role === 'customer') return

    const saved = allowedPanelForRole(user.role, lastPanel || readLastPanel())
    const next = saved || viewForRole(user.role)
    if (!next || next === 'customer') return
    rememberPanel(next)
    setView(next)
  }, [user, setView, lastPanel, rememberPanel])

  const openLogin = useCallback(
    (intent = 'customer') => {
      logout()
      clearLastPanel()
      setLastPanel('')
      setLoginIntent(intent)
      setView('login')
    },
    [logout, setView]
  )

  const handleLoginSuccess = useCallback(
    async (loggedInUser, nextView) => {
      const dest = nextView || viewForRole(loggedInUser?.role)

      // Customer must never inherit a previous Admin/Seller panel memory
      if (loggedInUser?.role === 'customer' || dest === 'customer') {
        clearLastPanel()
        setLastPanel('')
        setView('customer')
      } else {
        rememberPanel(dest)
        setView(dest)
      }

      try {
        if (loggedInUser?.role === 'superadmin') {
          await refreshAdminQueues()
        }
        await refreshCatalog?.()
      } catch {
        /* ignore */
      }
    },
    [refreshAdminQueues, refreshCatalog, setView, rememberPanel]
  )

  const handleLogout = useCallback(() => {
    logout()
    clearLastPanel()
    setLastPanel('')
    setView('customer')
  }, [logout, setView])

  useEffect(() => {
    if (STAFF_VIEWS.includes(view)) {
      rememberPanel(view)
    }
  }, [view, rememberPanel])

  // Migrate saved Category Ops / old admin view → Admin Panel
  useEffect(() => {
    if (rawView === 'platform_ops' || rawView === 'store_admin') {
      rememberPanel('superadmin')
      setView('superadmin')
    }
  }, [rawView, setView, rememberPanel])

  // If a customer is somehow on a staff view, send them home — never Admin login
  useEffect(() => {
    if (loading) return
    if (!isAuthenticated || !user) return
    if (user.role === 'customer' && STAFF_VIEWS.includes(view)) {
      clearLastPanel()
      setLastPanel('')
      setView('customer')
    }
  }, [loading, isAuthenticated, user, view, setView])

  // Staff views: only unauthenticated users go to login; wrong-role users go to their own home
  useEffect(() => {
    if (loading) return
    if (!STAFF_VIEWS.includes(view)) return

    if (!isAuthenticated || !user) {
      const intent =
        view === 'rider'
          ? 'driver'
          : view === 'franchise'
            ? 'franchise'
            : view === 'superadmin'
              ? 'superadmin'
              : 'store_owner'
      setLoginIntent(intent)
      setView('login')
      return
    }

    if (!canAccessView(user, view)) {
      const home = viewForRole(user.role)
      if (user.role === 'customer') {
        clearLastPanel()
        setLastPanel('')
      }
      setView(home === 'customer' ? 'customer' : home)
    }
  }, [loading, view, isAuthenticated, user, setView])

  const dashboardLabel = useMemo(() => {
    if (!user) return null
    if (user.role === 'customer') return '👤 My Account'
    const saved = allowedPanelForRole(user.role, lastPanel || readLastPanel())
    return panelLabelFor(saved || viewForRole(user.role), user.role)
  }, [user, lastPanel])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">
        Loading…
      </div>
    )
  }

  if (view === 'seller_register') {
    return (
      <SellerRegisterPage
        onBackToLogin={() => {
          setLoginIntent('store_owner')
          setView('login')
        }}
        onSuccess={() => {
          setLoginIntent('store_owner')
          setView('login')
        }}
      />
    )
  }

  if (view === 'franchise_page') {
    return (
      <FranchisePage
        onBack={goStorefront}
        onOpenLogin={() => openLogin('franchise')}
      />
    )
  }

  if (view === 'login') {
    return (
      <LoginPage
        key={loginIntent}
        initialRole={loginIntent}
        onSuccess={handleLoginSuccess}
        onBackToStore={goStorefront}
        onSellerRegister={() => setView('seller_register')}
      />
    )
  }

  if (view === 'seller' && isAuthenticated && user?.role === 'store_owner') {
    return (
      <SellerPanel key="seller" onNavigateCustomer={goStorefront} onLogout={handleLogout} />
    )
  }

  if (view === 'superadmin' && isAuthenticated && canAccessView(user, view)) {
    return (
      <AdminPanel
        key="superadmin"
        onNavigateCustomer={goStorefront}
        onLogout={handleLogout}
      />
    )
  }

  // Rider hub: logged-in partners see panel; guests see apply/signup gate (Japto Delivery Partner)
  if (view === 'rider') {
    if (isAuthenticated && canAccessView(user, view)) {
      return (
        <RiderHub
          key="rider"
          onNavigateCustomer={goStorefront}
          onNavigateAdmin={() => openLogin('store_owner')}
          onLogout={handleLogout}
        />
      )
    }
    return (
      <RiderHub
        key="rider-guest"
        onNavigateCustomer={goStorefront}
        onNavigateAdmin={() => openLogin('driver')}
        onLogout={handleLogout}
      />
    )
  }

  if (view === 'franchise' && isAuthenticated && canAccessView(user, view)) {
    return (
      <FranchisePanel
        key="franchise"
        onNavigateCustomer={goStorefront}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <CustomerHome
      onOpenLogin={openLogin}
      onLogout={handleLogout}
      onGoDashboard={goDashboard}
      dashboardLabel={dashboardLabel}
      onOpenFranchise={() => setView('franchise_page')}
    />
  )
}

export default App
