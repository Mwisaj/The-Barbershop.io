# Restore admin access

If you forgot your password and email recovery is not configured:

1. Stop the backend (Ctrl+C in its terminal).
2. Run `npm run admin:setup` in the project folder. On a hosted backend, run this in the backend shell with `DATA_DIR` pointing to the existing persistent data directory.
3. Save the generated password in your password manager and restart the backend (`npm run dev` locally).
4. Sign in with the generated password. In admin Settings, choose your own password using the password form.

This replaces only the admin credential; bookings and settings remain intact. Changing `ADMIN_PASSWORD` alone does not replace an existing password.

# Enable email recovery

Configure these environment variables on the backend and restart it:

- `ADMIN_EMAIL`: the owner's recovery email address.
- `RESEND_API_KEY`: a Resend sending API key.
- `RESET_EMAIL_FROM`: a sender address on your verified Resend domain.
- `APP_ORIGIN`: the public website origin (for example, `https://your-site.vercel.app`).

See the [Resend email API documentation](https://resend.com/docs/api-reference/emails/send-email) for sender setup. Keep keys on the backend; never prefix them with `VITE_`. Local development and backend startup load the project's ignored `.env` file. Existing terminal or hosting environment variables take precedence. `.env.example` is documentation only. Restart the backend after changing configuration.

Use **Forgot password?** on the admin login screen, enter `ADMIN_EMAIL`, and open the emailed link to choose a password of 15–128 characters. Links expire after 15 minutes, are single-use, and become invalid on backend restart or password change. Successful recovery signs out all admin sessions. Reset tokens are kept only as hashes in server memory and do not appear in server request URLs. Requests use a generic response so they do not disclose the registered address. Check backend logs and the mail provider dashboard if delivery fails.

Email delivery must be configured and tested with your real mailbox before relying on recovery. The local automated tests simulate delivery and do not send real mail.
