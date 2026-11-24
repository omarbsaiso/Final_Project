import { BookOpen, ChartNoAxesCombined, ChevronLeft, ChevronRight, Headphones, LayoutDashboard, LogOut, Settings2, UsersRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

const items = [
  { to: '/', label: 'dashboard', icon: LayoutDashboard },
  { to: '/calls', label: 'calls', icon: Headphones },
  { to: '/knowledge', label: 'knowledge', icon: BookOpen },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onClose }) {
  const { user, logout } = useAuth();
  const { t } = usePreferences();
  const isRtl = document.documentElement.dir === 'rtl';
  return (
    <>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`app-sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><ChartNoAxesCombined size={21} strokeWidth={2.2} /></div>
          {!collapsed && <div className="brand-name">call<span>miner</span></div>}
          <button className="sidebar-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">N</div>
          {!collapsed && <div className="workspace-copy"><strong>Northstar Support</strong><span>Workspace</span></div>}
          {!collapsed && <span className="workspace-chevron">⌄</span>}
        </div>
        <div className="sidebar-section-label">{!collapsed && 'WORKSPACE'}</div>
        <nav className="sidebar-nav">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={collapsed ? t(label) : undefined} onClick={onClose}>
              <Icon size={19} strokeWidth={1.8} /><span>{t(label)}</span>
            </NavLink>
          ))}
          {user?.role === 'Admin' && (
            <NavLink to="/users" title={collapsed ? t('users') : undefined} onClick={onClose}>
              <UsersRound size={19} strokeWidth={1.8} /><span>{t('users')}</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/settings" title={collapsed ? t('settings') : undefined} onClick={onClose}>
            <Settings2 size={19} strokeWidth={1.8} /><span>{t('settings')}</span>
          </NavLink>
          <div className="sidebar-profile">
            <div className="user-avatar avatar-navy">{user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
            {!collapsed && <div className="sidebar-profile-copy"><strong>{user?.name}</strong><span>{user?.role}</span></div>}
            {!collapsed && <button className="logout-button" onClick={logout} title={t('logout')}><LogOut size={17} /></button>}
          </div>
        </div>
      </aside>
    </>
  );
}
