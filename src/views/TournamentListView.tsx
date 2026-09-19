import React, { useState, useEffect } from 'react';
import type { Tournament } from '../types/database.types';
import { fetchTournaments } from '../lib/supabase';
import { TournamentCard } from '../components/TournamentCard';
import { RegistrationModal } from '../components/RegistrationModal';
import { useAuth } from '../context/AuthContext';
import { Trophy, Crosshair, Loader2, Globe, Send, MessageSquare } from 'lucide-react';

import { getEffectiveTournamentStatus } from '../lib/dateUtils';

interface TournamentListViewProps {
  onSelectTournament: (id: string) => void;
  onNavigateToCreate: () => void;
}

export const TournamentListView: React.FC<TournamentListViewProps> = ({
  onSelectTournament,
  onNavigateToCreate,
}) => {
  const { user, isAdmin, loginWithDiscord } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'active' | 'completed'>('all');
  const [registeringTournament, setRegisteringTournament] = useState<Tournament | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTournaments();
      setTournaments(data);
    } catch (err) {
      console.error('Failed to load tournaments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegisterClick = (tournament: Tournament) => {
    if (!user) {
      loginWithDiscord();
      return;
    }
    setRegisteringTournament(tournament);
  };

  const filteredTournaments = tournaments.filter((t) => {
    const effStatus = getEffectiveTournamentStatus(t);
    if (filter === 'open') return effStatus === 'registration_open';
    if (filter === 'active') return effStatus === 'in_progress';
    if (filter === 'completed') return effStatus === 'completed';
    return true;
  });

  return (
    <div>
      {/* Hero Banner with background video & frosted glass overlay */}
      <section className="hero-banner-container">
        {/* Background video from user's Banner folder */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="hero-bg-video"
        >
          <source src="./banner.mp4" type="video/mp4" />
        </video>

        {/* Frosted Glass Overlay */}
        <div className="hero-glass-overlay">
          <div className="hero-content">
            <div className="hero-tag">
              <Crosshair size={15} />
              Официальные турниры сообщества
            </div>
            <h1 className="hero-title">
              BAZA <span>CS2</span>
            </h1>
            <p className="hero-desc">
              Локальная киберспортивная лига серверов BAZA в форматах 1x1, 2x2 и 5x5.
              Автоматическая проверка Faceit ELO, олимпийская сетка на выбывание и честное судейство.
            </p>
            <div className="hero-actions">
              {isAdmin && (
                <button onClick={onNavigateToCreate} className="btn btn-primary">
                  <Trophy size={16} />
                  Создать турнир
                </button>
              )}
              <button
                onClick={() => {
                  const el = document.getElementById('tournaments-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn btn-secondary"
              >
                Смотреть сетку и матчи
              </button>
            </div>

            {/* Official Community Links Bar */}
            <div className="hero-social-bar">
              <span className="hero-social-title">Наши ресурсы:</span>
              <a
                href="https://baza-cs2.ru/"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-social-link"
              >
                <Globe size={14} color="var(--md-primary)" />
                Сайт серверов baza-cs2.ru
              </a>
              <a
                href="https://discord.gg/R2UjANCZeE"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-social-link"
              >
                <MessageSquare size={14} color="var(--brand-discord)" />
                Discord сервер
              </a>
              <a
                href="https://t.me/bazacs"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-social-link"
              >
                <Send size={14} color="var(--brand-telegram)" />
                Telegram канал
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Tournaments List Section */}
      <section id="tournaments-section">
        <div className="section-header">
          <h2 className="section-title">
            Турниры <span>BAZA CS2</span>
          </h2>

          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Все ({tournaments.length})
            </button>
            <button
              className={`filter-tab ${filter === 'open' ? 'active' : ''}`}
              onClick={() => setFilter('open')}
            >
              Регистрация ({tournaments.filter((t) => getEffectiveTournamentStatus(t) === 'registration_open').length})
            </button>
            <button
              className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Идут сейчас ({tournaments.filter((t) => getEffectiveTournamentStatus(t) === 'in_progress').length})
            </button>
            <button
              className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Завершенные ({tournaments.filter((t) => getEffectiveTournamentStatus(t) === 'completed').length})
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            <Loader2 size={36} className="spin-animate" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--md-primary)' }} />
            Загрузка турниров...
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Турниров в этой категории пока нет.</p>
          </div>
        ) : (
          <div className="tournaments-grid">
            {filteredTournaments.map((tournament) => (
              <TournamentCard
                key={tournament.id}
                tournament={tournament}
                onSelect={onSelectTournament}
                onRegisterClick={handleRegisterClick}
              />
            ))}
          </div>
        )}
      </section>

      {/* Registration Modal */}
      {registeringTournament && user && (
        <RegistrationModal
          tournament={registeringTournament}
          currentUser={user}
          onClose={() => setRegisteringTournament(null)}
          onSuccess={() => {
            loadData();
            onSelectTournament(registeringTournament.id);
          }}
        />
      )}
    </div>
  );
};
