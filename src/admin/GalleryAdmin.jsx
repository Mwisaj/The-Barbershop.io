import { useState } from 'react';
import { api } from '../lib/storage';
import chairImage from '../../images/download (4).jpg';

const empty = { id: '', caption: '', src: '' };
const imageSource = src => src === 'default-chair' ? chairImage : src;

async function prepareImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.5]) {
      const src = canvas.toDataURL('image/jpeg', quality);
      if (src.length <= 1390000) return src;
    }
    throw new Error('This photo is too large. Please choose a smaller image.');
  } finally { image.close(); }
}

export function GalleryAdmin({ gallery, setGallery }) {
  const [draft, setDraft] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fileKey, setFileKey] = useState(0);
  const reset = () => { setDraft(empty); setFileKey(key => key + 1); };
  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try { const src = await prepareImage(file); setDraft(value => ({ ...value, src })); }
    catch (err) { setError(err.message || 'Unable to read this image.'); }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault();
    if (!draft.src && !draft.id) { setError('Choose an image first.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      setGallery(await api('/gallery', { method: 'POST', body: { action: 'save', ...draft } }));
      reset(); setMessage('Gallery saved. Your changes are now visible on the gallery page.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove(item) {
    if (!window.confirm(`Delete "${item.caption}" from the gallery?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      setGallery(await api('/gallery', { method: 'POST', body: { action: 'delete', id: item.id } }));
      if (draft.id === item.id) reset();
      setMessage('Image deleted from the gallery.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return (
    <section>
      <h2 className="font-head text-2xl">Manage gallery</h2>
      <p className="mt-2 mb-6 text-sm text-[var(--text-soft)]">Upload photos, edit captions, or replace and delete existing images. Up to 30 images.</p>
      {error && <p role="alert" className="mb-4 text-[var(--rust)]">{error}</p>}
      {message && <p role="status" className="mb-4 text-green-700">{message}</p>}
      <form onSubmit={save} className="mb-8 rounded-xl border border-[var(--line)] p-5">
        <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
          <legend className="mb-3 font-semibold">{draft.id ? 'Edit image' : 'Add image'}</legend>
          <div>
            <label htmlFor="gallery-caption" className="block mb-1 text-sm">Caption / image description</label>
            <input id="gallery-caption" required maxLength={200} value={draft.caption} onChange={event => setDraft({ ...draft, caption: event.target.value })} className="w-full rounded border border-[var(--line)] p-3" />
          </div>
          <div>
            <label htmlFor="gallery-file" className="block mb-1 text-sm">{draft.id ? 'Replace photo (optional)' : 'Choose photo'}</label>
            <input key={fileKey} id="gallery-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} className="block w-full text-sm" aria-describedby="gallery-file-help" />
            <p id="gallery-file-help" className="mt-2 text-xs text-[var(--text-soft)]">JPG, PNG or WebP, up to 10 MB. Photos are resized automatically.</p>
          </div>
          {draft.src && <img src={imageSource(draft.src)} alt={draft.caption || 'Photo preview'} className="h-40 w-40 rounded-lg object-cover" />}
          <div className="flex gap-4">
            <button type="submit" className="rounded bg-[var(--accent-strong)] px-5 py-3 text-white">{busy ? 'Please wait…' : draft.id ? 'Save changes' : 'Add image'}</button>
            {draft.id && <button type="button" onClick={reset} className="underline">Cancel editing</button>}
          </div>
        </fieldset>
      </form>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map(item => (
          <article key={item.id} className="overflow-hidden rounded-xl border border-[var(--line)]">
            {item.src ? <img src={imageSource(item.src)} alt={item.caption} className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-[var(--paper-2)] text-sm">No photo yet</div>}
            <div className="p-4">
              <p className="mb-3 font-medium">{item.caption}</p>
              <div className="flex gap-5">
                <button disabled={busy} className="underline disabled:opacity-50" onClick={() => { setDraft({ ...item }); setFileKey(key => key + 1); setError(''); setMessage(''); document.getElementById('gallery-caption')?.focus(); }}>Edit / replace</button>
                <button disabled={busy} className="text-[var(--rust)] underline disabled:opacity-50" onClick={() => remove(item)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!gallery.length && <p className="text-[var(--text-soft)]">No gallery images yet. Add your first photo above.</p>}
    </section>
  );
}
