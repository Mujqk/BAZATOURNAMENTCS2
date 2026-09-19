import React, { useState } from 'react';
import { getSupabaseCredentials, saveSupabaseCredentials, demoStore } from '../lib/supabase';
import { X, Database, CheckCircle, RefreshCw, Key, ShieldCheck } from 'lucide-react';

interface SupabaseSettingsModalProps {
  onClose: () => void;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({ onClose }) => {
  const currentCreds = getSupabaseCredentials();
  const [url, setUrl] = useState(currentCreds.url);
  const [anonKey, setAnonKey] = useState(currentCreds.anonKey);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(url, anonKey);
    setSaved(true);
  };

  const handleClear = () => {
    saveSupabaseCredentials('', '');
  };

  const handleResetDemo = () => {
    demoStore.reset();
    window.location.reload();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <div className="modal-title">
            <Database size={22} color="#ff8e00" />
            Подключение к Supabase
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.4rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="alert-box alert-info">
              <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Работа без бэкенда:</strong> Сайт полностью статичен и готов к деплою на GitHub Pages. Все операции идут напрямую в Supabase через публичный <code>anon</code>-ключ с защитой через RLS-политики.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Supabase Project URL</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>https://&lt;project&gt;.supabase.co</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="https://xyzcompany.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Supabase Public Anon Key</span>
                <Key size={14} color="var(--text-muted)" />
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
              />
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--accent-orange)', marginBottom: '0.5rem' }}>
                Быстрые шаги настройки в Supabase Dashboard:
              </div>
              <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                <li>В <strong>SQL Editor</strong> выполните скрипт миграции из папки <code>supabase/migrations/</code>.</li>
                <li>В <strong>Authentication &rarr; Providers &rarr; Discord</strong> включите провайдер, указав Client ID и Client Secret из Discord Developer Portal.</li>
                <li>Деплой функции: <code>supabase functions deploy faceit-lookup</code> и установка секрета <code>supabase secrets set FACEIT_API_KEY=...</code></li>
              </ol>
            </div>

            {saved && (
              <div className="alert-box alert-warning">
                <CheckCircle size={18} />
                <span>Настройки сохранены! Страница перезагружается...</span>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={handleResetDemo}
              className="btn btn-secondary btn-sm"
              title="Сбросить состояние демо-турниров и команд к начальному"
            >
              <RefreshCw size={14} />
              Сбросить демо-данные
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {url && (
                <button type="button" onClick={handleClear} className="btn btn-danger btn-sm">
                  Перейти в демо
                </button>
              )}
              <button type="submit" className="btn btn-primary">
                Сохранить ключи
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
