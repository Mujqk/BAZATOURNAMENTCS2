import React, { useState } from 'react';
import type { Tournament } from '../types/database.types';
import { updateTournament, deleteTournament } from '../lib/supabase';
import { X, Trash2, Save, AlertCircle, Loader2, Layers, Calendar } from 'lucide-react';

interface AdminEditTournamentModalProps {
  tournament: Tournament;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export const AdminEditTournamentModal: React.FC<AdminEditTournamentModalProps> = ({
  tournament,
  onClose,
  onUpdated,
  onDeleted,
}) => {
  const [title, setTitle] = useState(tournament.title);
  const [description, setDescription] = useState(tournament.description || '');
  const [regStart, setRegStart] = useState(
    new Date(tournament.registration_start).toISOString().slice(0, 16)
  );
  const [tournStart, setTournStart] = useState(
    new Date(tournament.tournament_start).toISOString().slice(0, 16)
  );
  const [prizeFirst, setPrizeFirst] = useState(tournament.prize_first || '');
  const [prizeSecond, setPrizeSecond] = useState(tournament.prize_second || '');
  const [prizeThird, setPrizeThird] = useState(tournament.prize_third || '');

  // Faceit Rules
  const [allowLvl10, setAllowLvl10] = useState(tournament.allow_lvl10 !== false);
  const [maxLvl10PerTeam, setMaxLvl10PerTeam] = useState<string>(
    tournament.max_lvl10_per_team !== null && tournament.max_lvl10_per_team !== undefined
      ? String(tournament.max_lvl10_per_team)
      : ''
  );
  const [minFaceitLevel, setMinFaceitLevel] = useState<number>(tournament.min_faceit_level || 1);
  const [maxFaceitLevel, setMaxFaceitLevel] = useState<number>(tournament.max_faceit_level || 10);
  const [maxFaceitElo, setMaxFaceitElo] = useState<string>(
    tournament.max_faceit_elo ? String(tournament.max_faceit_elo) : ''
  );
  const [minFaceitElo, setMinFaceitElo] = useState<string>(
    tournament.min_faceit_elo ? String(tournament.min_faceit_elo) : ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (new Date(tournStart) <= new Date(regStart)) {
      setError('Дата старта турнира должна быть позже даты старта регистрации.');
      return;
    }

    if (minFaceitLevel > maxFaceitLevel) {
      setError('Минимальный уровень Faceit не может быть больше максимального уровня.');
      return;
    }

    setIsSaving(true);
    try {
      await updateTournament(tournament.id, {
        title: title.trim(),
        description: description.trim() || null,
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
      });

      onUpdated();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmation = prompt(
      `Внимание! Вы собираетесь БЕЗВОЗВРАТНО удалить турнир «${tournament.title}» со всеми командами и сеткой.\n\nДля подтверждения введите слово «УДАЛИТЬ»:`
    );

    if (confirmation !== 'УДАЛИТЬ') {
      if (confirmation !== null) {
        alert('Удаление отменено: неверный текст подтверждения.');
      }
      return;
    }

    setIsDeleting(true);
    try {
      await deleteTournament(tournament.id);
      onDeleted();
      onClose();
    } catch (err) {
      setError('Ошибка при удалении: ' + (err as Error).message);
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px' }}
      >
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Layers size={20} color="var(--md-primary)" />
            Редактирование турнира
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {error && (
              <div className="alert-box alert-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Название турнира</label>
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                maxLength={64}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Описание и правила</label>
              <textarea
                className="form-input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Правила, формат матчей (BO1/BO3), ссылки..."
              />
            </div>

            {/* Dates Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">
                  <Calendar size={14} color="var(--md-primary)" />
                  Старт регистрации
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
                  <Calendar size={14} color="var(--md-secondary)" />
                  Старт турнира
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
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: '#ff5500', color: '#000', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>FACEIT</span>
                  Регламент Faceit и ограничения состава
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Лимиты 10 уровня, диапазон уровней и порог максимального ELO.
                </div>
              </div>

              {/* 10 LVL Switcher & Limit */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Игроки 10 уровня Faceit</label>
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
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      Запрет 10 lvl
                    </button>
                  </div>
                </div>

                {allowLvl10 && tournament.format !== '1x1' && (
                  <div className="form-group">
                    <label className="form-label">Максимум 10 lvl в команде</label>
                    <select
                      className="form-input"
                      value={maxLvl10PerTeam}
                      onChange={(e) => setMaxLvl10PerTeam(e.target.value)}
                    >
                      <option value="">Без ограничений</option>
                      <option value="1">Не более 1 игрока (1x 10 lvl)</option>
                      <option value="2">Не более 2 игроков (2x 10 lvl)</option>
                      {tournament.format === '5x5' && <option value="3">Не более 3 игроков (3x 10 lvl)</option>}
                    </select>
                  </div>
                )}
              </div>

              {/* Levels range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Мин. уровень Faceit (1-10)</label>
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
                  <label className="form-label">Макс. уровень Faceit (1-10)</label>
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

              {/* ELO limits */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Макс. Faceit ELO (отсечь 3500+)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="напр. 2500 или 3000 (пусто = без лимита)"
                    value={maxFaceitElo}
                    onChange={(e) => setMaxFaceitElo(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Мин. Faceit ELO (опционально)</label>
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
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🏆 Призовой фонд
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#ffd700', fontWeight: 600, marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#c0c0c0', fontWeight: 600, marginBottom: '0.25rem' }}>
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
                  <label style={{ display: 'block', fontSize: '0.72rem', color: '#cd7f32', fontWeight: 600, marginBottom: '0.25rem' }}>
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
          </div>

          <div
            className="modal-footer"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <button
              type="button"
              onClick={handleDelete}
              className="btn btn-secondary btn-sm"
              disabled={isSaving || isDeleting}
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
            >
              {isDeleting ? <Loader2 size={16} className="spin-animate" /> : <Trash2 size={16} />}
              Удалить турнир
            </button>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={isSaving || isDeleting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving || isDeleting}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="spin-animate" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Сохранить изменения
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
