import React, { useState, useEffect } from 'react';
import { useRuntime } from './services/runtime.js';
import { initApi } from './services/api.js';
import api from './services/api.js';

// Import Pages
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';
import CustomerDashboard from './pages/CustomerDashboard.jsx';
import CustomerOrderBook from './pages/CustomerOrderBook.jsx';
import Customers from './pages/Customers.jsx';
import Vendors from './pages/Vendors.jsx';
import Products from './pages/Products.jsx';
import Orders from './pages/Orders.jsx';
import Quotations from './pages/Quotations.jsx';
import Bills from './pages/Bills.jsx';
import Payments from './pages/Payments.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import Whatsapp from './pages/Whatsapp.jsx';
import PublicTracking from './pages/PublicTracking.jsx';
import PublicFeedback from './pages/PublicFeedback.jsx';

// Advanced Pages
import Employees from './pages/Employees.jsx';
import FinancialDashboard from './pages/FinancialDashboard.jsx';
import Purchases from './pages/Purchases.jsx';
import Expenses from './pages/Expenses.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import Masters from './pages/Masters.jsx';

export default function App() {
  const ctx = useRuntime();
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Multi-branch state
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(localStorage.getItem('selected_branch_id') || '');

  // Initialize API and handle Host Context authentication on mount
  useEffect(() => {
    if (ctx) {
      initApi(ctx);
      if (ctx.user && ctx.user.role) {
        let mappedRole = 'admin';
        if (ctx.user.role.includes('staff') || ctx.user.role.includes('delivery')) {
          mappedRole = 'staff';
        }
        setUser({
          id: ctx.user.id || 'dev',
          name: ctx.user.name || 'Core Administrator',
          role: mappedRole
        });
        setCheckingAuth(false);
        return;
      }
    }

    // Otherwise, check local storage token (standalone MERN flow)
    const localToken = localStorage.getItem('sis_jwt_token');
    if (localToken) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
          // Set initial page based on role
          if (res.data.user.role === 'staff') {
            setActivePage('staff_dashboard');
          } else if (res.data.user.role === 'Customer') {
            setActivePage('customer_dashboard');
          } else {
            setActivePage('dashboard');
          }
        })
        .catch(() => {
          localStorage.removeItem('sis_jwt_token');
        })
        .finally(() => {
          setCheckingAuth(false);
        });
    } else {
      setCheckingAuth(false);
    }
  }, [ctx]);

  // Load branches list on admin login
  useEffect(() => {
    if (user && user.role === 'admin') {
      api.get('/branches')
        .then(res => setBranches(res.data))
        .catch(err => console.error('Failed to load branches:', err));
    }
  }, [user]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    if (userData.role === 'staff') {
      setActivePage('staff_dashboard');
    } else if (userData.role === 'Customer') {
      setActivePage('customer_dashboard');
    } else {
      setActivePage('dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sis_jwt_token');
    localStorage.removeItem('sis_user_role');
    localStorage.removeItem('sis_user_name');
    setUser(null);
  };

  const handleBranchChange = (e) => {
    const val = e.target.value;
    setSelectedBranch(val);
    localStorage.setItem('selected_branch_id', val);
    // Reload state or filter logic
    window.location.reload();
  };

  const isTrackingRoute = window.location.pathname.startsWith('/track/');
  const isFeedbackRoute = window.location.pathname.startsWith('/feedback/');

  if (isTrackingRoute) {
    return <PublicTracking />;
  }

  if (isFeedbackRoute) {
    return <PublicFeedback />;
  }

  if (checkingAuth) {
    return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Authenticating user session...</div>;
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Render Sidebar based on user role
  const renderSidebar = () => {
    if (user.role === 'admin') {
      return (
        <div className="sidebar no-print" style={{ width: '250px', minWidth: '250px', display: 'flex', flexDirection: 'column', height: '100vh', background: '#ffffff', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
          <div className="sidebar-header" style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="logo-circle" style={{ background: '#3b82f6', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>T</div>
            <div>
              <div className="sidebar-title" style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14px' }}>Tammewar Pharmacy</div>
              <div className="sidebar-subtitle" style={{ fontSize: '11px', color: '#64748b' }}>Distributions</div>
            </div>
          </div>
          <div className="sidebar-menu" style={{ flex: 1, overflowY: 'auto', padding: '15px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* SECTION 1: BUSINESS OPERATIONS */}
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 10px 4px 10px' }}>
              Business Operations
            </div>
            <div className={`menu-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>📊 Dashboard</div>
            <div className={`menu-item ${activePage === 'financial_dashboard' ? 'active' : ''}`} onClick={() => setActivePage('financial_dashboard')}>💰 Sales Dashboard</div>
            <div className={`menu-item ${activePage === 'customers' ? 'active' : ''}`} onClick={() => setActivePage('customers')}>👥 Customers</div>
            <div className={`menu-item ${activePage === 'vendors' ? 'active' : ''}`} onClick={() => setActivePage('vendors')}>🏢 Suppliers</div>
            <div className={`menu-item ${activePage === 'products' ? 'active' : ''}`} onClick={() => setActivePage('products')}>📦 Products</div>
            <div className={`menu-item ${activePage === 'purchases' ? 'active' : ''}`} onClick={() => setActivePage('purchases')}>🚚 Purchase Orders</div>
            <div className={`menu-item ${activePage === 'expenses' ? 'active' : ''}`} onClick={() => setActivePage('expenses')}>💸 Expenses</div>
            <div className={`menu-item ${activePage === 'orders' ? 'active' : ''}`} onClick={() => setActivePage('orders')}>📋 Orders</div>
            <div className={`menu-item ${activePage === 'quotations' ? 'active' : ''}`} onClick={() => setActivePage('quotations')}>📄 Quotes</div>
            <div className={`menu-item ${activePage === 'bills' ? 'active' : ''}`} onClick={() => setActivePage('bills')}>🧾 Bills</div>
            <div className={`menu-item ${activePage === 'payments' ? 'active' : ''}`} onClick={() => setActivePage('payments')}>💳 Payments</div>
            <div className={`menu-item ${activePage === 'employees' ? 'active' : ''}`} onClick={() => setActivePage('employees')}>👥 Staff</div>
            <div className={`menu-item ${activePage === 'reports' ? 'active' : ''}`} onClick={() => setActivePage('reports')}>📈 Reports</div>
            <div className={`menu-item ${activePage === 'whatsapp' ? 'active' : ''}`} onClick={() => setActivePage('whatsapp')}>💬 WhatsApp</div>

            {/* SECTION 2: SYSTEM SETUP */}
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '16px 10px 4px 10px', borderTop: '1px solid #f1f5f9', marginTop: '8px' }}>
              System Setup
            </div>
            <div className={`menu-item ${activePage === 'masters' ? 'active' : ''}`} onClick={() => setActivePage('masters')}>🏷️ Masters</div>
            <div className={`menu-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => setActivePage('settings')}>⚙️ Settings</div>
            <div className={`menu-item ${activePage === 'audit_logs' ? 'active' : ''}`} onClick={() => setActivePage('audit_logs')}>📜 Logs</div>
          </div>
          <div className="sidebar-footer" style={{ padding: '20px', borderTop: '1px solid #e2e8f0' }}>
            <div className="user-info" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <div className="user-avatar" style={{ background: '#cbd5e1', color: '#1e293b', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{user.name}</strong>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Administrator</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} style={{ width: '100%', padding: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Logout</button>
          </div>
        </div>
      );
    } else if (user.role === 'staff') {
      // Staff Sidebar
      return (
        <div className="sidebar no-print" style={{ width: '250px', minWidth: '250px', display: 'flex', flexDirection: 'column', height: '100vh', background: '#ffffff', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
          <div className="sidebar-header" style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="logo-circle" style={{ background: '#10b981', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>S</div>
            <div>
              <div className="sidebar-title" style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14px' }}>Staff Portal</div>
              <div className="sidebar-subtitle" style={{ fontSize: '11px', color: '#64748b' }}>Delivery Driver</div>
            </div>
          </div>
          <div className="sidebar-menu" style={{ flex: 1, overflowY: 'auto', padding: '15px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className={`menu-item ${activePage === 'staff_dashboard' ? 'active' : ''}`} onClick={() => setActivePage('staff_dashboard')}>🚚 Assigned Orders</div>
          </div>
          <div className="sidebar-footer" style={{ padding: '20px', borderTop: '1px solid #e2e8f0' }}>
            <div className="user-info" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <div className="user-avatar" style={{ background: '#cbd5e1', color: '#1e293b', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>S</div>
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{user.name}</strong>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Delivery Driver</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} style={{ width: '100%', padding: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Logout</button>
          </div>
        </div>
      );
    } else if (user.role === 'Customer') {
      // Customer Sidebar
      return (
        <div className="sidebar no-print" style={{ width: '250px', minWidth: '250px', display: 'flex', flexDirection: 'column', height: '100vh', background: '#ffffff', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
          <div className="sidebar-header" style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="logo-circle" style={{ background: '#f59e0b', color: '#fff', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>C</div>
            <div>
              <div className="sidebar-title" style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14px' }}>Customer Portal</div>
              <div className="sidebar-subtitle" style={{ fontSize: '11px', color: '#64748b' }}>Online Booking</div>
            </div>
          </div>
          <div className="sidebar-menu" style={{ flex: 1, overflowY: 'auto', padding: '15px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div className={`menu-item ${activePage === 'customer_dashboard' ? 'active' : ''}`} onClick={() => setActivePage('customer_dashboard')}>🏠 Home</div>
            <div className={`menu-item ${activePage === 'customer_book_order' ? 'active' : ''}`} onClick={() => setActivePage('customer_book_order')}>🛒 Book Order</div>
            {/* We will add more Customer Portal pages here like 'My Orders', 'My Invoices' */}
          </div>
          <div className="sidebar-footer" style={{ padding: '20px', borderTop: '1px solid #e2e8f0' }}>
            <div className="user-info" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <div className="user-avatar" style={{ background: '#cbd5e1', color: '#1e293b', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>C</div>
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{user.name}</strong>
                <div style={{ fontSize: '10px', color: '#64748b' }}>Customer</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout} style={{ width: '100%', padding: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>Logout</button>
          </div>
        </div>
      );
    }
  };

  // Render Page Content Component
  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard role={user.role} onNavigate={(page) => setActivePage(page)} />;
      case 'staff_dashboard':
        return <StaffDashboard user={user} />;
      case 'customer_dashboard':
        return <CustomerDashboard user={user} />;
      case 'customer_book_order':
        return <CustomerOrderBook user={user} onNavigate={(page) => setActivePage(page)} />;
      case 'customers':
        return <Customers />;
      case 'vendors':
        return <Vendors />;
      case 'masters':
        return <Masters />;
      case 'products':
        return <Products />;
      case 'orders':
        return <Orders />;
      case 'quotations':
        return <Quotations />;
      case 'bills':
        return <Bills />;
      case 'payments':
        return <Payments />;
      case 'reports':
        return <Reports />;
      case 'whatsapp':
        return <Whatsapp />;
      case 'settings':
        return <Settings />;
      
      // Advanced Modules Case mappings
      case 'employees':
        return <Employees />;
      case 'financial_dashboard':
        return <FinancialDashboard />;
      case 'purchases':
        return <Purchases />;
      case 'expenses':
        return <Expenses />;
      case 'audit_logs':
        return <AuditLogs />;

      default:
        if (user.role === 'staff') return <StaffDashboard user={user} />;
        if (user.role === 'Customer') return <CustomerDashboard user={user} />;
        return <Dashboard role={user.role} onNavigate={(page) => setActivePage(page)} />;
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {renderSidebar()}
      <div className="content-area" style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#f8fafc' }}>
        <div className="top-navbar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
          <div className="page-title" style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>
            🏪 Shop &raquo; <span style={{ textTransform: 'capitalize', color: '#3b82f6' }}>{activePage.replace(/_/g, ' ')}</span>
          </div>

          {/* Active Branch Scoped Selection Dropdown */}
          <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {user.role === 'admin' && branches.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Select Branch:</label>
                <select 
                  value={selectedBranch}
                  onChange={handleBranchChange}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px', outline: 'none' }}
                >
                  <option value="">All Branches</option>
                  {branches.map(br => (
                    <option key={br._id} value={br._id}>{br.name}</option>
                  ))}
                </select>
              </div>
            )}

            <span style={{ fontSize: '13px', color: '#64748b' }}>Status: <strong>System Online</strong></span>
            <div className="nav-profile" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge" style={{ textTransform: 'uppercase', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: user.role === 'admin' ? '#dbeafe' : '#d1fae5', color: user.role === 'admin' ? '#1e40af' : '#065f46', fontWeight: '600' }}>
                {user.role}
              </span>
              <strong style={{ fontSize: '14px', color: '#1e293b' }}>{user.name}</strong>
            </div>
          </div>
        </div>
        <div className="main-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
