import React, { useState } from 'react';
import type { Tournament } from '../types/database.types';
import { updateTournament, deleteTournament } from '../lib/supabase';
import { X, Trash2, Save, AlertCircle, Loader2, Trophy, Calendar } from 'lucide-react';

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
            <Trophy size={20} color="var(--md-primary)" />
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
