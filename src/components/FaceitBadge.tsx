import React from 'react';

interface FaceitBadgeProps {
  level: number | null | undefined;
  elo?: number | null;
  showElo?: boolean;
}

export const FaceitBadge: React.FC<FaceitBadgeProps> = ({ level, elo, showElo = true }) => {
  if (level === null || level === undefined) {
    return (
      <span className="faceit-badge faceit-lvl-none" title="Faceit аккаунт не найден">
        —
      </span>
    );
  }

  const safeLevel = Math.max(1, Math.min(10, level));

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <span
        className={`faceit-badge faceit-lvl-${safeLevel}`}
        title={`Faceit Level ${safeLevel} ${elo ? `(${elo} ELO)` : ''}`}
      >
        {safeLevel}
      </span>
      {showElo && elo !== undefined && elo !== null && (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {elo} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ELO</span>
        </span>
      )}
    </div>
  );
};
