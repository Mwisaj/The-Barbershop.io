import { useState } from 'react';
import { api } from '../lib/storage';

export function PasswordAdmin() {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setError(''); setSuccess('');
    if (values.newPassword !== values.confirmPassword) { setError('The new passwords do not match.'); return; }
    setSaving(true);
    try {
      await api('/auth/password', { method: 'POST', body: values });
      setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess('Password updated. Use your new password next time you sign in. Other admin sessions have been signed out.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={save} className="mt-8 border-t border-[var(--line)] pt-6 space-y-3">
      <h2 className="font-head text-xl">Admin PIN / password</h2>
      <p id="password-help" className="text-sm text-[var(--text-soft)]">Your admin login uses a password of 15–128 characters. Enter your current password to update it.</p>
      {[
        ['currentPassword', 'Current password', 'current-password'],
        ['newPassword', 'New password', 'new-password'],
        ['confirmPassword', 'Confirm new password', 'new-password'],
      ].map(([key, label, autoComplete]) => (
        <div key={key}>
          <label htmlFor={key} className="text-xs text-[var(--text-soft)]">{label}</label>
          <input id={key} type="password" autoComplete={autoComplete} required maxLength={128}
            minLength={key === 'currentPassword' ? undefined : 15} disabled={saving} aria-describedby="password-help"
            value={values[key]} onChange={event => { setValues({ ...values, [key]: event.target.value }); setError(''); setSuccess(''); }}
            className="w-full border border-[var(--line)] rounded-sm px-3 py-2 mt-1" />
        </div>
      ))}
      {error && <p role="alert" className="text-sm text-[var(--rust)]">{error}</p>}
      {success && <p role="status" className="text-sm text-green-300">{success}</p>}
      <button type="submit" disabled={saving} className="bg-[var(--accent-strong)] text-white px-6 py-2.5 rounded-sm font-medium disabled:opacity-50">
        {saving ? 'Updating…' : 'Update admin password'}
      </button>
    </form>
  );
}
