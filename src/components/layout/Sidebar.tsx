import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  IconLayoutDashboard,
  IconLayoutKanban,
  IconUsers,
  IconSettings,
  IconLogout,
} from '@tabler/icons-react';

interface SidebarProps {
  opened: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/board', label: 'Kanban', icon: IconLayoutKanban },
  { to: '/members', label: 'Membros', icon: IconUsers },
];

const ADMIN_ITEMS = [
  { to: '/settings', label: 'Configurações', icon: IconSettings },
];

export default function Sidebar({ opened, onClose }: SidebarProps) {
  const { profile, signOut, isAdmin } = useAuth();
  const location = useLocation();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile overlay */}
      {opened && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${opened ? 'open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">LP</div>
          <span className="sidebar-brand">Leona Projetos</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Menu</div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`sidebar-item ${isActive(item.to) ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <Icon size={18} className="icon" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>

          {isAdmin && (
            <div className="sidebar-section">
              <div className="sidebar-section-title">Admin</div>
              {ADMIN_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`sidebar-item ${isActive(item.to) ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Icon size={18} className="icon" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          )}
        </nav>

        {/* Footer - User */}
        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => signOut()} title="Sair">
            <div className="sidebar-user-avatar">
              {profile ? getInitials(profile.full_name) : '?'}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {profile?.full_name || 'Carregando...'}
              </div>
              <div className="sidebar-user-role">
                {profile?.role === 'admin' ? 'Administrador' : 'Operação'}
              </div>
            </div>
            <IconLogout size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        </div>
      </aside>
    </>
  );
}
