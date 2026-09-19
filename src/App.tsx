import { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { TournamentListView } from './views/TournamentListView';
import { TournamentDetailView } from './views/TournamentDetailView';
import { AdminCreateTournamentView } from './views/AdminCreateTournamentView';
import { Globe, Send, MessageSquare } from 'lucide-react';

export function App() {
  const [currentView, setCurrentView] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith('tournament=')) {
        const id = hash.replace('tournament=', '');
        setSelectedTournamentId(id);
        setCurrentView('detail');
      } else if (hash === 'create') {
        setCurrentView('create');
      } else {
        setCurrentView('list');
        setSelectedTournamentId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view: 'list' | 'detail' | 'create', tournamentId?: string) => {
    if (view === 'detail' && tournamentId) {
      window.location.hash = `tournament=${tournamentId}`;
    } else if (view === 'create') {
      window.location.hash = 'create';
    } else {
      window.location.hash = '';
    }
  };

  return (
    <AuthProvider>
      <div className="app-container">
        <Header
          currentView={currentView}
          onNavigate={(view, id) => navigateTo(view as any, id)}
        />

        <main className="main-content">
          {currentView === 'list' && (
            <TournamentListView
              onSelectTournament={(id) => navigateTo('detail', id)}
              onNavigateToCreate={() => navigateTo('create')}
            />
          )}

          {currentView === 'detail' && selectedTournamentId && (
            <TournamentDetailView
              tournamentId={selectedTournamentId}
              onBack={() => navigateTo('list')}
            />
          )}

          {currentView === 'create' && (
            <AdminCreateTournamentView
              onBack={() => navigateTo('list')}
              onCreated={(id) => navigateTo('detail', id)}
            />
          )}
        </main>

        <footer
          style={{
            borderTop: '1px solid var(--glass-border)',
            padding: '2.5rem 1.5rem',
            background: 'rgba(17, 14, 23, 0.95)',
            backdropFilter: 'blur(12px)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>
                BAZA <span>CS2</span>
              </div>
              <div>
                Турнирная платформа игрового сообщества серверов Counter-Strike 2
              </div>
            </div>

            {/* Official External Links */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <a
                href="https://baza-cs2.ru/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}
              >
                <Globe size={15} color="var(--md-primary)" />
                baza-cs2.ru
              </a>
              <a
                href="https://discord.gg/R2UjANCZeE"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}
              >
                <MessageSquare size={15} color="var(--brand-discord)" />
                Discord
              </a>
              <a
                href="https://t.me/bazacs"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}
              >
                <Send size={15} color="var(--brand-telegram)" />
                Telegram
              </a>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}

export default App;
