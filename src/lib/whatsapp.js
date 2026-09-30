// Accept an international phone number and an unencoded message.
export function whatsappUrl(phone, message = '') {
  const number = String(phone ?? '').replace(/\D/g, '');
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
