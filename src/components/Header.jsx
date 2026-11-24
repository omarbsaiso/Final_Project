import { Bell, ChevronDown, Menu, Search, Settings, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

export default function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const { t } = usePreferences();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    if (search.trim()) navigate(`/calls?search=${encodeURIComponent(search.trim())}`);
  }

  return (
    <header className="app-header">
      <button className="mobile-menu-button" onClick={onMenu} aria-label="Open navigation"><Menu size={21} /></button>
      <form className="header-search" onSubmit={submitSearch}>
        <Search size={17} />
        <input ref={searchRef} aria-label="Search calls" placeholder={`${t('search')} calls, agents…`} value={search} onChange={(event) => setSearch(event.target.value)} />
        <kbd>Ctrl K</kbd>
      </form>
      <div className="header-actions">
        <span className="header-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
        <div className="profile-menu-wrap">
          <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen(!notificationsOpen); setHasUnread(false); }}><Bell size={19} />{hasUnread && <i />}</button>
          {notificationsOpen && <div className="profile-dropdown notification-dropdown"><strong>Notifications</strong><p><span className="notification-dot" />2 calls need a supervisor review</p><Link to="/calls?status=Needs%20review" onClick={() => setNotificationsOpen(false)}>Review calls</Link></div>}
        </div>
        <div className="profile-menu-wrap">
          <button className="header-profile" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
            <span className="user-avatar avatar-navy">{user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
            <span className="header-profile-name">{user?.name?.split(' ')[0]}</span><ChevronDown size={15} />
          </button>
          {menuOpen && <div className="profile-dropdown">
            <Link to="/settings" onClick={() => setMenuOpen(false)}><UserRound size={16} />My profile</Link>
            <Link to="/settings" onClick={() => setMenuOpen(false)}><Settings size={16} />Settings</Link>
            <button onClick={logout}><span className="dropdown-logout">↗</span>{t('logout')}</button>
          </div>}
        </div>
      </div>
    </header>
  );
}
