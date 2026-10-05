import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '../App.jsx';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useSession();
  const { pathname } = useLocation();
  const pageTitle = pathname === '/settings'
    ? 'Settings'
    : pathname === '/tenders/new'
      ? 'Add Tender'
      : pathname.endsWith('/edit')
        ? 'Edit Tender'
        : pathname === '/'
          ? 'Overview'
          : 'Tender Details';

  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">G</div>
          {!collapsed && <div className="brand-copy"><strong>Garg Construction</strong><span>TENDER DESK</span></div>}
        </div>
        <div className="nav-section-label">{!collapsed && 'WORKSPACE'}</div>
        <div className="nav-category">{!collapsed && 'Tender'}</div>
        <nav className="side-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Tender List">
            <span className="nav-symbol">▤</span>{!collapsed && <span>Tender</span>}
          </NavLink>
          {/* <NavLink to="/tenders/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Add Tender">
            <span className="nav-symbol">＋</span>{!collapsed && <span>Add Tender</span>}
          </NavLink> */}
        </nav>
        <div className="nav-section-label nav-settings-label">{!collapsed && 'PREFERENCES'}</div>
        <nav className="side-nav">
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Settings">
            <span className="nav-symbol">⚙</span>{!collapsed && <span>Settings</span>}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge"><span className="status-dot" />{!collapsed && 'Local data secured on this device'}</div>
          <button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>
            <span>{collapsed ? '›' : '‹'}</span>{!collapsed && 'Collapse sidebar'}
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">Tender management <span>/</span> <strong>{pageTitle}</strong></div>
          <div className="user-menu">
            <div className="avatar">{user?.username?.slice(0, 1).toUpperCase() || 'A'}</div>
            <div className="welcome"><span>Welcome,</span><strong>{user?.username}</strong></div>
            <button className="text-button" onClick={signOut}>Sign out</button>
          </div>
        </header>
        <main className="main-content"><Outlet /></main>
        <footer className="app-footer">Tender Desk <span>•</span> Local workspace</footer>
      </div>
    </div>
  );
}
