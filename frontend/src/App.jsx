import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'

import Login from './pages/Login'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'

import Products from './pages/products/Products'
import ProductDetail from './pages/products/ProductDetail'
import Categories from './pages/categories/Categories'
import StockIn from './pages/stock/StockIn'
import StockMovements from './pages/stock/StockMovements'
import StockAdjustments from './pages/stock/StockAdjustments'
import LowStock from './pages/stock/LowStock'

import NewSale from './pages/sales/NewSale'
import Sales from './pages/sales/Sales'
import SaleDetail from './pages/sales/SaleDetail'
import Orders from './pages/orders/Orders'

import Customers from './pages/customers/Customers'
import CustomerDetail from './pages/customers/CustomerDetail'
import Loans from './pages/loans/Loans'
import LoanDetail from './pages/loans/LoanDetail'

import Suppliers from './pages/suppliers/Suppliers'
import Payments from './pages/payments/Payments'

import ReportsSales from './pages/reports/SalesReport'
import ReportsStock from './pages/reports/StockReport'
import ReportsCustomers from './pages/reports/CustomersReport'
import ReportsLoans from './pages/reports/LoansReport'
import ReportsFinancial from './pages/reports/FinancialReport'

import Users from './pages/admin/Users'
import AuditLogs from './pages/admin/AuditLogs'
import SettingsPage from './pages/admin/SettingsPage'
import Backups from './pages/admin/Backups'
import Profile from './pages/Profile'

function Protected({ children, permission }) {
  const { user, hasPermission } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (permission && !hasPermission(permission)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Protected permission="dashboard.read"><Dashboard /></Protected>} />

              <Route path="/products" element={<Protected permission="products.read"><Products /></Protected>} />
              <Route path="/products/:id" element={<Protected permission="products.read"><ProductDetail /></Protected>} />
              <Route path="/categories" element={<Protected permission="categories.read"><Categories /></Protected>} />
              <Route path="/stock/in" element={<Protected permission="stock.create"><StockIn /></Protected>} />
              <Route path="/stock/movements" element={<Protected permission="stock.read"><StockMovements /></Protected>} />
              <Route path="/stock/adjustments" element={<Protected permission="stock.adjust"><StockAdjustments /></Protected>} />
              <Route path="/stock/low" element={<Protected permission="products.read"><LowStock /></Protected>} />

              <Route path="/sales/new" element={<Protected permission="sales.create"><NewSale /></Protected>} />
              <Route path="/sales" element={<Protected permission="sales.read"><Sales /></Protected>} />
              <Route path="/sales/:id" element={<Protected permission="sales.read"><SaleDetail /></Protected>} />
              <Route path="/orders" element={<Protected permission="orders.read"><Orders /></Protected>} />

              <Route path="/customers" element={<Protected permission="customers.read"><Customers /></Protected>} />
              <Route path="/customers/:id" element={<Protected permission="customers.read"><CustomerDetail /></Protected>} />
              <Route path="/loans" element={<Protected permission="loans.read"><Loans /></Protected>} />
              <Route path="/loans/:id" element={<Protected permission="loans.read"><LoanDetail /></Protected>} />

              <Route path="/suppliers" element={<Protected permission="suppliers.read"><Suppliers /></Protected>} />
              <Route path="/payments" element={<Protected permission="payments.read"><Payments /></Protected>} />

              <Route path="/reports/sales" element={<Protected permission="reports.read"><ReportsSales /></Protected>} />
              <Route path="/reports/stock" element={<Protected permission="reports.read"><ReportsStock /></Protected>} />
              <Route path="/reports/customers" element={<Protected permission="reports.read"><ReportsCustomers /></Protected>} />
              <Route path="/reports/loans" element={<Protected permission="reports.read"><ReportsLoans /></Protected>} />
              <Route path="/reports/financial" element={<Protected permission="reports.read"><ReportsFinancial /></Protected>} />

              <Route path="/users" element={<Protected permission="users.read"><Users /></Protected>} />
              <Route path="/audit-logs" element={<Protected permission="auditLogs.read"><AuditLogs /></Protected>} />
              <Route path="/settings" element={<Protected permission="settings.manage"><SettingsPage /></Protected>} />
              <Route path="/backups" element={<Protected permission="backups.read"><Backups /></Protected>} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  )
}
