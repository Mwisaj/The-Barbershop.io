import { useEffect, useState } from 'react';
import { api } from '../lib/storage';

export function PasswordRecovery({ onBack }) {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.split('?')[1]).get('reset') || '');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname + window.location.search + '#admin');
  }, [token]);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(''); setMessage('');
    if (token && newPassword !== confirmPassword) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await api(token ? '/auth/reset-password' : '/auth/forgot-password', {
        method: 'POST', body: token ? { token, newPassword, confirmPassword } : { email },
      });
      setMessage(token ? 'Password reset. Sign in with your new password.' : result.message);
      if (token) { setDone(true); setToken(''); setNewPassword(''); setConfirmPassword(''); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const inputClass = 'w-full border border-[var(--line)] rounded-sm px-4 py-3 bg-transparent mt-2 mb-4';
  return <div className="font-body max-w-sm mx-auto px-5 py-20">
    <h1 className="font-head text-2xl mb-4">{token ? 'Choose a new password' : done ? 'Password updated' : 'Forgot password?'}</h1>
    {!done && <form onSubmit={submit}>
      {token ? <>
        <p id="reset-help" className="text-sm mb-4">Use 15–128 characters for your new password.</p>
        <label htmlFor="reset-password">New password</label>
        <input id="reset-password" type="password" autoComplete="new-password" aria-describedby="reset-help" required minLength={15} maxLength={128} disabled={busy} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />
        <label htmlFor="reset-confirm">Confirm new password</label>
        <input id="reset-confirm" type="password" autoComplete="new-password" required minLength={15} maxLength={128} disabled={busy} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
      </> : <>
        <p className="text-sm mb-4">Enter the email address configured for your admin account.</p>
        <label htmlFor="recovery-email">Admin email</label>
        <input id="recovery-email" type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
      </>}
      <button disabled={busy} className="w-full bg-[var(--accent-strong)] text-white px-6 py-3 rounded-sm disabled:opacity-50">{busy ? 'Please wait…' : token ? 'Reset password' : 'Send reset link'}</button>
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-[var(--rust)]">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
    {token && <button disabled={busy} onClick={() => { setToken(''); setError(''); }} className="mt-4 text-sm underline block">Request a new reset link</button>}
    <button disabled={busy} onClick={onBack} className="mt-5 text-sm underline">Back to sign in</button>
  </div>;
}
