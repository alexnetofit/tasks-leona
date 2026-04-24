import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { Menu, ActionIcon, Avatar, Group, Text, Burger, Drawer, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard, IconLayoutKanban, IconUsers,
  IconLogout, IconChevronDown,
} from '@tabler/icons-react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/board', label: 'Kanban', icon: IconLayoutKanban },
  { to: '/members', label: 'Membros', icon: IconUsers },
];

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [mobileMenuOpened, { open: openMobile, close: closeMobile }] = useDisclosure();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="app-header-inner">
          {/* Left: Logo + Nav */}
          <div className="app-header-left">
            <NavLink to="/" className="app-logo">
              <img src="/images/logo/simbolo-branco.png" alt="Leona" className="app-logo-img" />
              <span className="app-logo-text">Leona Projetos</span>
            </NavLink>

            {/* Desktop nav */}
            <nav className="app-nav">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`app-nav-item ${isActive(item.to) ? 'active' : ''}`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Right: User Menu */}
          <div className="app-header-right">
            <Menu shadow="lg" width={200} position="bottom-end">
              <Menu.Target>
                <button className="app-user-btn">
                  <Avatar size={28} radius="xl" color="violet" variant="filled">
                    {profile ? getInitials(profile.full_name) : '?'}
                  </Avatar>
                  <span className="app-user-name">{profile?.full_name || '...'}</span>
                  <IconChevronDown size={14} style={{ opacity: 0.5 }} />
                </button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>
                  <Text size="xs" c="dimmed">{profile?.email}</Text>
                  <Text size="xs" c="dimmed">{profile?.role === 'admin' ? 'Administrador' : 'Operação'}</Text>
                </Menu.Label>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={14} />} color="red" onClick={() => signOut()}>
                  Sair
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Mobile burger */}
            <Burger opened={mobileMenuOpened} onClick={openMobile} size="sm" className="app-burger" color="var(--text-secondary)" />
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      <Drawer opened={mobileMenuOpened} onClose={closeMobile} title="Menu" position="right" size="xs"
        styles={{ content: { backgroundColor: 'var(--bg-surface)' }, header: { backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' } }}>
        <Stack gap="xs">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to}
                className={`app-mobile-nav-item ${isActive(item.to) ? 'active' : ''}`}
                onClick={closeMobile}>
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 8 }}>
            <button className="app-mobile-nav-item" onClick={() => { signOut(); closeMobile(); }} style={{ color: '#ef4444' }}>
              <IconLogout size={18} />
              <span>Sair</span>
            </button>
          </div>
        </Stack>
      </Drawer>

      {/* Content */}
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
