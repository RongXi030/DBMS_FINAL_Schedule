import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Calendar, Clock, Users, Settings, FileText, User } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const employeeLinks = [
    { path: '/employee/dashboard', label: '打卡系統', icon: <Clock size={20} /> },
    { path: '/employee/leave', label: '請假申請', icon: <FileText size={20} /> },
    { path: '/employee/schedule', label: '班表查詢', icon: <Calendar size={20} /> },
    { path: '/employee/settings', label: '個人設定', icon: <User size={20} /> },
  ];

  const adminLinks = [
    { path: '/admin/dashboard', label: '儀表板', icon: <LayoutDashboard size={20} /> },
    { path: '/admin/clock-in', label: '打卡系統', icon: <Clock size={20} /> },
    { path: '/admin/leave', label: '請假申請', icon: <FileText size={20} /> },
    { path: '/admin/employees', label: '員工管理', icon: <Users size={20} /> },
    { path: '/admin/rules', label: '排班規則', icon: <Settings size={20} /> },
    { path: '/admin/schedule', label: '班表管理', icon: <Calendar size={20} /> },
    { path: '/admin/reports', label: '統計報表', icon: <FileText size={20} /> },
    { path: '/admin/settings', label: '個人設定', icon: <User size={20} /> },
  ];

  const links = user?.position === '管理者' ? adminLinks : employeeLinks;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        backgroundColor: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        padding: 'var(--space-3) var(--space-2)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '0 var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <h1 style={{ fontSize: '1.2rem', color: 'var(--color-primary-600)' }}>喬魯諾‧喬班啦！</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{user?.position}系統</p>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {links.map(link => {
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link 
                key={link.path} 
                to={link.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--color-primary-50)' : 'transparent',
                  color: isActive ? 'var(--color-primary-600)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s ease'
                }}
              >
                {link.icon}
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ 
          marginTop: 'auto', 
          padding: 'var(--space-3) var(--space-2)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.last_name}{user?.first_name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{user?.account}</div>
          </div>
          <button 
            onClick={logout}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-secondary)', padding: '8px',
              borderRadius: 'var(--radius-sm)'
            }}
            title="登出"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
