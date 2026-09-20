import React, { useState } from 'react';
import type { TournamentFormat } from '../types/database.types';
import { createTournament } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, PlusCircle, AlertCircle, Loader2 } from 'lucide-react';

interface AdminCreateTournamentViewProps {
  onBack: () => void;
  onCreated: (tournamentId: string) => void;
}

export const AdminCreateTournamentView: React.FC<AdminCreateTournamentViewProps> = ({
  onBack,
  onCreated,
}) => {
  const { user, isAdmin } = useAuth();

  const now = new Date();
  const defaultRegStart = new Date(now.getTime() + 10 * 60000).toISOString().slice(0, 16);
  const defaultTournStart = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 16);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('5x5');
  const [bracketSize, setBracketSize] = useState<4 | 8 | 16 | 32>(8);
  const [regStart, setRegStart] = useState(defaultRegStart);
  const [tournStart, setTournStart] = useState(defaultTournStart);
  const [prizeFirst, setPrizeFirst] = useState('');
  const [prizeSecond, setPrizeSecond] = useState('');
  const [prizeThird, setPrizeThird] = useState('');

  // Flexible Faceit Rules
  const [allowLvl10, setAllowLvl10] = useState(true);
  const [maxLvl10PerTeam, setMaxLvl10PerTeam] = useState<string>('');
  const [minFaceitLevel, setMinFaceitLevel] = useState<number>(1);
  const [maxFaceitLevel, setMaxFaceitLevel] = useState<number>(10);
  const [maxFaceitElo, setMaxFaceitElo] = useState<string>('');
  const [minFaceitElo, setMinFaceitElo] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin || !user) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem' }}>
        <AlertCircle size={48} color="var(--accent-red)" style={{ marginBottom: '1rem' }} />
        <h2>Доступ ограничен</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Создание турниров доступно только администраторам сообщества.
        </p>
        <button onClick={onBack} className="btn btn-secondary" style={{ marginTop: '1.5rem' }}>
          Вернуться на главную
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (new Date(tournStart) <= new Date(regStart)) {
      setError('Дата старта турнира должна быть позже даты начала регистрации.');
      return;
    }

    if (minFaceitLevel > maxFaceitLevel) {
      setError('Минимальный уровень Faceit не может быть больше максимального уровня.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newTournament = await createTournament(
        {
          title: title.trim(),
          description: description.trim() || null,
          format,
          bracket_size: bracketSize,
          registration_start: new Date(regStart).toISOString(),
          tournament_start: new Date(tournStart).toISOString(),
          prize_first: prizeFirst.trim() || null,
          prize_second: prizeSecond.trim() || null,
          prize_third: prizeThird.trim() || null,
          allow_lvl10: allowLvl10,
          max_lvl10_per_team: !allowLvl10 ? 0 : (maxLvl10PerTeam ? parseInt(maxLvl10PerTeam, 10) : null),
          min_faceit_level: minFaceitLevel,
          max_faceit_level: maxFaceitLevel,
          min_faceit_elo: minFaceitElo.trim() ? parseInt(minFaceitElo.trim(), 10) : null,
          max_faceit_elo: maxFaceitElo.trim() ? parseInt(maxFaceitElo.trim(), 10) : null,
          created_by: user.id,
        },
        user
      );

      onCreated(newTournament.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <button onClick={onBack} className="back-link">
          <ArrowLeft size={16} />
          Назад ко всем турнирам
        </button>
      </div>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-medium)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Создание турнира CS2
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Турнир появится на сайте со статусом «Скоро» и перейдет в регистрацию автоматически.
          </p>
        </div>

        {error && (
          <div className="alert-box alert-error" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">
              <span>Название турнира</span>
              <span style={{ color: 'var(--accent-orange)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="Например: CS2 Summer Major 5x5 Cup"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={3}
              maxLength={80}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <span>Описание турнира и правила</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Опционально</span>
            </label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Карты, регламент матчей, призовой фонд, особенности регламента..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                <span>Игровой формат</span>
              </label>
              <select
                className="form-select"
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
              >
                <option value="1x1">1x1 (Aim / Duel King)</option>
                <option value="2x2">2x2 (Wingman Duo)</option>
                <option value="5x5">5x5 (Full Team)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Размер сетки (слотов)</span>
              </label>
              <select
                className="form-select"
                value={bracketSize}
                onChange={(e) => setBracketSize(parseInt(e.target.value, 10) as any)}
              >
                <option value={4}>4 команды (2 раунда)</option>
                <option value={8}>8 команд (3 раунда)</option>
                <option value={16}>16 команд (4 раунда)</option>
                <option value={32}>32 команды (5 раундов)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                <span>Старт регистрации</span>
              </label>
              <input
                type="datetime-local"
                className="form-input"
                value={regStart}
                onChange={(e) => setRegStart(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Старт турнира</span>
              </label>
              <input
                type="datetime-local"
                className="form-input"
                value={tournStart}
                onChange={(e) => setTournStart(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Flexible Faceit Rules Section */}
          <div
            style={{
              background: 'rgba(255, 85, 0, 0.04)',
              border: '1px solid rgba(255, 85, 0, 0.25)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: '#ff5500', color: '#000', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800 }}>FACEIT</span>
                Регламент Faceit и ограничения состава
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Настройте баланс турнира: разрешенные уровни, запрет 10-х уровней или лимит на команду, а также порог максимального ELO.
              </div>
            </div>

            {/* 10 LVL Switcher & Limit */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Участие 10 уровня Faceit</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setAllowLvl10(true)}
                    className={`btn ${allowLvl10 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Разрешены
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAllowLvl10(false);
                      setMaxLvl10PerTeam('0');
                    }}
                    className={`btn ${!allowLvl10 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ flex: 1, justifyContent: 'center', borderColor: !allowLvl10 ? 'var(--md-primary)' : undefined }}
                  >
                    Запрет 10 lvl
                  </button>
                </div>
              </div>

              {allowLvl10 && format !== '1x1' && (
                <div className="form-group">
                  <label className="form-label">Максимум 10 lvl в одной команде</label>
                  <select
                    className="form-select"
                    value={maxLvl10PerTeam}
                    onChange={(e) => setMaxLvl10PerTeam(e.target.value)}
                  >
                    <option value="">Без ограничений (любое кол-во)</option>
                    <option value="1">Не более 1 игрока (1x 10 lvl)</option>
                    <option value="2">Не более 2 игроков (2x 10 lvl)</option>
                    {format === '5x5' && <option value="3">Не более 3 игроков (3x 10 lvl)</option>}
                  </select>
                </div>
              )}
            </div>

            {/* Allowed Faceit Level Range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Минимальный уровень Faceit (1-10)</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={10}
                  value={minFaceitLevel}
                  onChange={(e) => setMinFaceitLevel(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Максимальный уровень Faceit (1-10)</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={10}
                  value={maxFaceitLevel}
                  onChange={(e) => setMaxFaceitLevel(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 10)))}
                />
              </div>
            </div>

            {/* Faceit ELO Limits */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">
                  <span>Максимальное Faceit ELO (отсечь 3500+ киборгов)</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="напр. 2500 или 3000 (пусто = без лимита)"
                  value={maxFaceitElo}
                  onChange={(e) => setMaxFaceitElo(e.target.value)}
                />
                <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                  Игроки с ELO выше указанного порога не смогут быть зарегистрированы.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Минимальное Faceit ELO (опционально)</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="напр. 1000 (пусто = без лимита)"
                  value={minFaceitElo}
                  onChange={(e) => setMinFaceitElo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Prize Pool Section */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '1.25rem',
              marginTop: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🏆 Призовой фонд (необязательно)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Укажите награды за призовые места (деньги, скины, VIP или роли).
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#ffd700', fontWeight: 700, marginBottom: '0.25rem' }}>
                  🥇 1 место (Золото)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="напр. 5 000 ₽ или Скин"
                  value={prizeFirst}
                  onChange={(e) => setPrizeFirst(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#c0c0c0', fontWeight: 700, marginBottom: '0.25rem' }}>
                  🥈 2 место (Серебро)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="напр. 2 500 ₽"
                  value={prizeSecond}
                  onChange={(e) => setPrizeSecond(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#cd7f32', fontWeight: 700, marginBottom: '0.25rem' }}>
                  🥉 3 место (Бронза)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="напр. VIP на сервере"
                  value={prizeThird}
                  onChange={(e) => setPrizeThird(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" onClick={onBack} className="btn btn-secondary">
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spin-animate" />
                  Создание...
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  Опубликовать турнир
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
