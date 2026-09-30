import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappUrl } from '../src/lib/whatsapp.js';

test('WhatsApp links remove number formatting and preserve the booking message', () => {
  assert.equal(whatsappUrl('+260 (972) 551-954'), 'https://wa.me/260972551954');
  const message = "Hi TJ!\nName: Jane & Joe\nLocation: https://www.google.com/maps/search/?api=1&query=-15.4,28.2\nNotes: 50% — entrance #2";
  const url = new URL(whatsappUrl('260972 551 954', message));
  assert.equal(url.pathname, '/260972551954');
  assert.equal(url.searchParams.get('text'), message);
  assert.deepEqual([...url.searchParams.keys()], ['text']);
});
