import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PlusCircle,
  LogIn,
  LogOut,
  Shield,
  User,
  Layers,
  Globe,
  Send,
  MessageSquare
} from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, tournamentId?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const { user, isAdmin, isDemoMode, loginWithDiscord, logout, switchDemoRole } = useAuth();

  return (
    <>
      <header className="header-bar">
        <div className="header-inner">
          {/* Brand: BAZA CS2 */}
          <div className="brand-logo" onClick={() => onNavigate('list')}>
            <div className="brand-title">
              BAZA <span>CS2</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="header-nav">
            <button
              className={`nav-link ${currentView === 'list' ? 'active' : ''}`}
              onClick={() => onNavigate('list')}
            >
              <Layers size={16} />
              Турниры
            </button>
            {isAdmin && (
              <button
                className={`nav-link ${currentView === 'create' ? 'active' : ''}`}
                onClick={() => onNavigate('create')}
              >
                <PlusCircle size={16} />
                Создать турнир
              </button>
            )}

            {/* Official server website link */}
            <a
              href="https://baza-cs2.ru/"
              target="_blank"
              rel="noopener noreferrer"
              className="nav-link nav-link-external"
              title="Перейти на основной сайт серверов BAZA CS2"
            >
              <Globe size={15} />
              Сервера BAZA
            </a>
          </nav>

          {/* Socials & Profile */}
          <div className="header-actions">
            {/* Telegram Link */}
            <a
              href="https://t.me/bazacs"
              target="_blank"
              rel="noopener noreferrer"
              className="header-social-btn tg"
              title="Наш Telegram канал"
            >
              <Send size={15} />
            </a>

            {/* Discord Link */}
            <a
              href="https://discord.gg/R2UjANCZeE"
              target="_blank"
              rel="noopener noreferrer"
              className="header-social-btn ds"
              title="Наш Discord сервер"
            >
              <MessageSquare size={15} />
            </a>


            {/* In demo mode, role selector is only shown when Supabase credentials are not set */}
            {isDemoMode && (
              <div className="demo-role-switcher" title="Демо-переключатель роли">
                <button
                  className={`demo-role-btn ${isAdmin ? 'active' : ''}`}
                  onClick={() => switchDemoRole('admin')}
                >
                  Админ
                </button>
                <button
                  className={`demo-role-btn ${user && !isAdmin ? 'active' : ''}`}
                  onClick={() => switchDemoRole('player')}
                >
                  Игрок
                </button>
                <button
                  className={`demo-role-btn ${!user ? 'active' : ''}`}
                  onClick={() => switchDemoRole('guest')}
                >
                  Гость
                </button>
              </div>
            )}

            {user ? (
              <div className="user-profile-menu">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.discord_username} className="user-avatar" />
                ) : (
                  <div className="user-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--md-surface-container-high)' }}>
                    <User size={15} />
                  </div>
                )}
                <div className="user-info">
                  <span className="user-name">{user.discord_username}</span>
                  <span className="user-role-tag">
                    {user.is_admin ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Shield size={10} color="var(--md-primary)" /> Администратор
                      </span>
                    ) : (
                      'Игрок'
                    )}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.25rem 0.5rem', marginLeft: '0.2rem' }}
                  title="Выйти"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button onClick={loginWithDiscord} className="btn btn-discord btn-sm">
                <LogIn size={15} />
                Войти через Discord
              </button>
            )}
          </div>
        </div>
      </header>

    </>
  );
};
