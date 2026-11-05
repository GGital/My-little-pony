import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

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

  const handleSignOut = async () => {
    try {
      await signOut();
      setMenuOpen(false);
      setNotification('You are signed out.');
      navigate('/events');
    } catch {
      // Fallback
      navigate('/events');
    }
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <header
        data-testid="app-header"
        className="navbar navbar-expand border-bottom px-3 py-2 text-white"
        style={{ backgroundColor: 'var(--ink-900)', borderColor: 'rgba(255, 255, 255, 0.12)' }}
      >
        <div className="container-fluid d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-4">
            <Link to="/events" className="navbar-brand text-white fw-bold d-flex align-items-center gap-2">
              <span style={{ color: 'var(--primary)' }}>✦</span>
              <span>TCG Event Hub</span>
            </Link>

            <nav className="d-flex align-items-center gap-3">
              <Link to="/events" className="nav-link text-white-50 text-white-hover">
                Events
              </Link>

              {status === 'signedIn' && user?.role === 'PARTICIPANT' && (
                <Link to="/me/registrations" className="nav-link text-white-50 text-white-hover">
                  My Events
                </Link>
              )}

              {status === 'signedIn' && user?.role === 'ORGANIZER' && (
                <>
                  <Link to="/organizer" className="nav-link text-white-50 text-white-hover">
                    Dashboard
                  </Link>
                  <Link
                    to="/organizer/events/new"
                    className="nav-link text-white-50 text-white-hover"
                  >
                    + Create event
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="d-flex align-items-center gap-3">
            {status === 'signedOut' && (
              <Link to="/login" className="btn btn-sm btn-outline-light px-3" role="link">
                Sign in
              </Link>
            )}

            {status === 'signedIn' && user && (
              <div className="dropdown position-relative" ref={menuRef}>
                <button
                  type="button"
                  className="btn btn-sm d-flex align-items-center gap-2 text-white p-1"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  data-testid="user-menu-btn"
                >
                  <span className="fw-semibold">{user.displayName}</span>
                  <span
                    className={
                      user.role === 'ORGANIZER'
                        ? 'badge-role-organizer'
                        : 'badge-role-player'
                    }
                  >
                    {user.role === 'ORGANIZER' ? 'ORGANIZER' : 'PLAYER'}
                  </span>
                </button>

                {menuOpen && (
                  <ul
                    className="dropdown-menu dropdown-menu-end show position-absolute mt-2 shadow"
                    style={{
                      right: 0,
                      backgroundColor: 'var(--surface)',
                      borderRadius: 'var(--radius-card)',
                    }}
                  >
                    <li>
                      <button
                        type="button"
                        className="dropdown-item text-danger"
                        onClick={handleSignOut}
                      >
                        Sign out
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {notification && (
        <div className="alert alert-info alert-dismissible m-3 mb-0" role="status">
          {notification}
          <button
            type="button"
            className="btn-close"
            onClick={() => setNotification(null)}
            aria-label="Close"
          />
        </div>
      )}

      <main className="flex-grow-1 px-3">
        <div className="app-panel">{children}</div>
      </main>
    </div>
  );
};
