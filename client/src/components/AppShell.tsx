import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';
import { Notice } from './Notice';

export const AppShell: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { status, user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // "You are signed out." belongs to the signed-out moment; signing in again clears it.
  useEffect(() => {
    if (status === 'signedIn') setNotification(null);
  }, [status]);

  // Leave the page first: if the session ended while still on a protected route, its guard would win the
  // race and send the user to /login instead of /events (contracts §4 UI).
  const handleSignOut = async () => {
    setMenuOpen(false);
    navigate('/events');
    await signOut();
    setNotification('You are signed out.');
  };

  const signedIn = status === 'signedIn' && user;
  const organizer = signedIn && user.role === 'ORGANIZER';
  const home = organizer
    ? { to: '/organizer', label: 'Dashboard' }
    : { to: '/me/registrations', label: 'My Events' };

  return (
    <div className="d-flex flex-column min-vh-100">
      <header data-testid="app-header" className="app-header">
        <Link to="/events" className="logo">
          <span className="logo__mark" aria-hidden="true" />
          TCG Event Hub
        </Link>

        <nav className="app-nav" aria-label="Main">
          <NavLink to="/events" end>
            Events
          </NavLink>
          {signedIn && user.role === 'PARTICIPANT' && <NavLink to="/me/registrations">My Events</NavLink>}
          {organizer && (
            <>
              <NavLink to="/organizer" end>
                Dashboard
              </NavLink>
              <NavLink to="/organizer/events/new">+ Create event</NavLink>
            </>
          )}
        </nav>

        <div className="app-header__end">
          {status === 'signedOut' && (
            <Link to="/login" className="btn-signin">
              Sign in
            </Link>
          )}

          {signedIn && (
            <div ref={menuRef}>
              <button
                type="button"
                className="acct"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                data-testid="user-menu-btn"
              >
                <span className="acct__name">{user.displayName}</span>
                <span className={`role-badge${organizer ? ' role-badge--organizer' : ''}`}>
                  {organizer ? 'ORGANIZER' : 'PLAYER'}
                </span>
                <Icon name="chev" size="sm" />
              </button>

              {menuOpen && (
                <ul className="acct-menu">
                  <li>
                    <Link to={home.to} onClick={() => setMenuOpen(false)}>
                      {home.label}
                    </Link>
                  </li>
                  <li>
                    <button type="button" className="acct-menu__danger" onClick={handleSignOut}>
                      Sign out
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>
      </header>

      {notification && (
        <div className="app-flash">
          <Notice tone="info" role="status" onClose={() => setNotification(null)}>
            {notification}
          </Notice>
        </div>
      )}

      <main className="app-main flex-grow-1">
        <div className="app-panel">{children}</div>
      </main>

      {/* Lab 5 R-08: which commit this page was built from (full SHA in GET /api/version). */}
      <footer className="app-footer">
        Build <code>{import.meta.env.VITE_GIT_SHA?.slice(0, 7) || 'local'}</code>
      </footer>
    </div>
  );
};
