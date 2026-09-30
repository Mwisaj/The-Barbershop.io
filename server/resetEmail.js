export function resetEmailSender({ apiKey = process.env.RESEND_API_KEY, from = process.env.RESET_EMAIL_FROM, fetchEmail = fetch } = {}) {
  if (!apiKey || !from) return null;
  return async ({ email, link }) => {
    const response = await fetchEmail('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Reset your admin password',
        text: `Use this link to choose a new admin password:\n\n${link}\n\nThis link expires in 15 minutes and works once. If you did not request it, ignore this email.` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Reset email delivery failed.');
  };
}
