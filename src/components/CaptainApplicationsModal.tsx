import React, { useState } from 'react';
import type { Tournament, Team, TeamJoinRequest } from '../types/database.types';
import { respondToTeamJoinRequest } from '../lib/supabase';
import { FaceitBadge } from './FaceitBadge';
import {
  FileText,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  Loader2,
  Users,
  MessageSquare
} from 'lucide-react';

interface CaptainApplicationsModalProps {
  tournament: Tournament;
  team: Team;
  applications: TeamJoinRequest[];
  onClose: () => void;
  onUpdated: () => void;
}

export const CaptainApplicationsModal: React.FC<CaptainApplicationsModalProps> = ({
  tournament,
  team,
  applications,
  onClose,
  onUpdated,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const maxMembers = tournament.format === '1x1' ? 1 : tournament.format === '2x2' ? 2 : 5;
  const currentMembersCount = team.members ? team.members.length : 1;
  const isFull = currentMembersCount >= maxMembers;

  const handleAction = async (reqId: string, action: 'accept' | 'reject') => {
    setProcessingId(reqId);
    setActionError(null);
    setActionSuccess(null);

    try {
      await respondToTeamJoinRequest(reqId, action, tournament.format);
      setActionSuccess(
        action === 'accept'
          ? 'Игрок успешно зачислен в состав команды!'
          : 'Заявка кандидата отклонена.'
      );
      onUpdated();
      setTimeout(() => {
        setActionSuccess(null);
      }, 2000);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const pendingApps = applications.filter((a) => a.status === 'pending');

  return (
    <div className="modal-backdrop" onClick={() => !processingId && onClose()}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '620px' }}
      >
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={20} color="var(--md-primary)" />
            Заявки кандидатов в команду ({pendingApps.length})
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.4rem' }}
            disabled={Boolean(processingId)}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Capacity Banner */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--glass-border)',
              borderRadius: '10px',
              padding: '0.85rem 1.1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="var(--md-primary)" />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{team.name}</span>
            </div>
            <span
              className={`badge ${isFull ? 'badge-completed' : 'badge-format'}`}
              style={{ fontWeight: 700 }}
            >
              Слоты: {currentMembersCount} из {maxMembers} {isFull ? '(Состав заполнен)' : ''}
            </span>
          </div>

          {actionError && (
            <div className="alert-box alert-error">
              <AlertCircle size={16} />
              <span>{actionError}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="alert-box alert-info" style={{ borderColor: 'var(--md-success)' }}>
              <Check size={16} color="var(--md-success)" />
              <span style={{ color: 'var(--md-success)', fontWeight: 600 }}>{actionSuccess}</span>
            </div>
          )}

          {/* Applications list */}
          {pendingApps.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
              <p>Нет ожидающих заявок в состав вашей команды.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pendingApps.map((app) => {
                const isProcessing = processingId === app.id;

                return (
                  <div
                    key={app.id}
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      padding: '1.1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                    }}
                  >
                    {/* Header: Avatar, Nick, Level/ELO */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {app.user?.avatar_url ? (
                          <img
                            src={app.user.avatar_url}
                            alt=""
                            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: 'var(--md-primary-container)',
                              color: 'var(--md-on-primary-container)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '1.1rem',
                            }}
                          >
                            {app.nickname.slice(0, 2).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                              {app.nickname}
                            </span>
                            {app.role && (
                              <span className="badge badge-format" style={{ fontSize: '0.68rem' }}>
                                {app.role}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            Discord: <strong>{app.user?.discord_username || 'Указан'}</strong>
                          </div>
                        </div>
                      </div>

                      <FaceitBadge level={app.faceit_level} elo={app.faceit_elo} />
                    </div>

                    {/* Steam Dossier Block */}
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.25)',
                        borderRadius: '8px',
                        padding: '0.65rem 0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>SteamID64: </span>
                        <strong style={{ color: 'var(--md-primary)' }}>{app.steam_id}</strong>
                      </div>
                      <a
                        href={`https://steamcommunity.com/profiles/${app.steam_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem' }}
                      >
                        Steam профиль <ExternalLink size={11} />
                      </a>
                    </div>

                    {/* Message from candidate */}
                    {app.message && (
                      <div
                        style={{
                          fontSize: '0.84rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.45,
                          background: 'rgba(255,255,255,0.02)',
                          padding: '0.6rem 0.8rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <MessageSquare size={11} /> Сообщение от кандидата:
                        </div>
                        «{app.message}»
                      </div>
                    )}

                    {/* Actions: Accept or Reject */}
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => handleAction(app.id, 'accept')}
                        className="btn btn-primary btn-sm"
                        disabled={isProcessing || isFull}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        {isProcessing ? (
                          <Loader2 size={14} className="spin-animate" />
                        ) : (
                          <Check size={15} />
                        )}
                        Принять в состав
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAction(app.id, 'reject')}
                        className="btn btn-secondary btn-sm"
                        disabled={isProcessing}
                        style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                      >
                        <X size={15} />
                        Отклонить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={Boolean(processingId)}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
