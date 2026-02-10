import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import KioskView from './components/KioskView';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  const [mode, setMode] = useState<'kiosk' | 'admin'>('kiosk');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F12' && mode === 'kiosk') {
        e.preventDefault();
        setShowPasswordModal(true);
        setPassword('');
        setAuthError('');
      }
      if (e.key === 'Escape') {
        if (showPasswordModal) {
          setShowPasswordModal(false);
        } else if (mode === 'admin') {
          setMode('kiosk');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [mode, showPasswordModal]);

  useEffect(() => {
    if (showPasswordModal && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [showPasswordModal]);

  const handlePasswordSubmit = async () => {
    if (!password.trim()) return;

    try {
      const valid = await invoke<boolean>('verify_admin_password', { password });
      if (valid) {
        setMode('admin');
        setShowPasswordModal(false);
        setPassword('');
        setAuthError('');
      } else {
        setAuthError('Contraseña incorrecta.');
      }
    } catch (err) {
      setAuthError(`Error al verificar: ${err}`);
    }
  };

  return (
    <div className="app">
      {mode === 'kiosk' ? (
        <KioskView />
      ) : (
        <AdminPanel onBack={() => setMode('kiosk')} />
      )}

      {showPasswordModal && (
        <div className="confirm-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">Contraseña de administrador:</p>
            <input
              ref={passwordInputRef}
              type="password"
              className="password-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePasswordSubmit();
              }}
              placeholder="Contraseña..."
            />
            {authError && <p className="auth-error">{authError}</p>}
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowPasswordModal(false)}>
                Cancelar
              </button>
              <button className="btn-confirm" onClick={handlePasswordSubmit}>
                Ingresar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
