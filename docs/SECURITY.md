# Security

## Model

| Area | Mechanism |
|---|---|
| Passwords (accounts & pastes) | bcrypt, cost 12 |
| Sessions | HMAC-SHA256 signed cookie, httpOnly, SameSite=Strict, Secure in production; re-validated against the DB on every request |
| Session revocation | `User.sessionVersion` is bumped on password change/reset and ban/suspend |
| API keys | `ps_` + 48 hex chars, per-key rate limit, global on/off switch |
| Paste passwords | Unlock token bound to paste id + current password hash, 1 h TTL; 10 guesses/min per IP+paste |
| Burn after read | Atomic DB claim; owner/moderator views never burn; confirmation screen protects against link previewers |
| Slugs | 8 chars of base62 from a CSPRNG (~47 bits) — unlisted links aren't guessable |
| Uploaded files | `nosniff`, sandboxing CSP, `attachment` by default, text served as `text/plain`, safe RFC 5987 file names |
| Uploads | Plan & site size limits, allowed types, banned extensions, executable/macro detection, double extensions |
| Storage paths | Server-generated keys; resolved paths must stay inside the storage root |
| Password reset | 32-byte token, only its SHA-256 stored, 30 min, single use, revokes sessions; never returned by the API in production |
| Enumeration | Login compares against a dummy hash for unknown emails; forgot-password always answers 200 |
| Privacy | Public responses never include emails or API keys; search never matches inside locked pastes |
| Admin | Audit log of admin actions (password hashes and secret settings are redacted) |
| Cron | `CRON_SECRET` (Bearer / header / query) |
| CORS | Off by default; allow-list via `apiCorsOrigins`; never with credentials |

## Rate limits

| What | Limit |
|---|---|
| Login | 10/min per IP, 20 per 15 min per account |
| Register | 5/min per IP |
| Forgot password | 5 per 15 min per IP |
| Reset password | 10 per 15 min per IP |
| Create paste | 30/min per user or IP |
| Upload | 20/min per user or IP |
| Paste password | 10/min per IP and paste |
| Report | 5 per 10 min per IP |
| API key | `apiRateLimit` per minute (default 60) |

Rate limits use the first `X-Forwarded-For` hop. Run behind a reverse proxy
that **overwrites** that header (the bundled `Caddyfile` does), otherwise
clients can spoof it.

## Issues fixed in this release

| Severity | Issue | Fix |
|---|---|---|
| Critical | Any client could read password-protected pastes by sending `x-unlocked: <pasteId>` (the id is returned in the "password required" response) | Signed, password-bound unlock tokens |
| Critical | `GET /api/user/<id>` (no login) returned any user's email **and API key** — e.g. the admin's | Public profile only; full record for the user/admins |
| Critical | `POST /api/auth/forgot-password` returned the reset token to anyone → takeover of any account | Token only returned in development; hashed storage; single use |
| High | Banned/suspended users and demoted admins kept their access for up to 7 days | Sessions re-validated on every request |
| High | Changing/resetting a password didn't sign other sessions out | `sessionVersion` |
| High | `/api/paste/raw` ignored burn-after-read (unlimited reads) | Shared access + burn logic for every read path |
| High | Two simultaneous readers could both get a burn-after-read paste | Atomic claim |
| Medium | Uploaded files were served with their user-supplied content type and no `nosniff`/CSP (only `attachment` stood between an uploaded HTML/SVG file and script execution on the site's origin) | `nosniff` + sandbox CSP + `text/plain` for text, inline only for safe types |
| High | Admin audit log stored password hashes from user edits and every secret setting | Redacted |
| Medium | Search matched inside password-protected pastes (content leak via search) | Locked pastes excluded from content search |
| Medium | Paste listings exposed owners' emails as their display name | Display name or "Member" only |
| Medium | Cron endpoints callable by anyone | `CRON_SECRET` |
| Medium | Slugs from `Math.random()`, 6 chars | CSPRNG, 8 chars |
| Medium | Paste password guessing unlimited | Rate limited |
| Low | Login timing revealed which emails exist | Dummy-hash comparison |
| Low | Reset tokens stored in `SiteSetting` and visible to admins | Dedicated hashed table |
| Low | Demo admin credentials shown on the login page in production | Development only |

## Production checklist

- [ ] `SESSION_SECRET` is 32+ random characters (`openssl rand -hex 32`)
- [ ] The seeded admin password (`admin123`) has been changed, or the account replaced
- [ ] `CRON_SECRET` is set and your scheduler sends it
- [ ] HTTPS terminates at your proxy and the proxy overwrites `X-Forwarded-For`
- [ ] `ALLOW_INSECURE_RESET_TOKENS` and `INSECURE_COOKIES` are unset
- [ ] A mailer is wired into `src/lib/mailer.ts` if users should reset their own passwords
- [ ] `apiCorsOrigins` lists only origins you trust (or is empty)
- [ ] Review *guest posting*, *registration*, plan limits, allowed file types and banned extensions
- [ ] Back up `prisma/db/custom.db` and the `storage/` directory together

## Known limitations

- No CAPTCHA verification yet: the admin captcha settings are stored and exposed
  to the client, but the server doesn't verify tokens.
- `apiRequireAuth` is stored but not enforced (browser guests and API guests
  look the same to the server).
- Malware scanning is signature/heuristic based — it is not an antivirus.
- In-memory rate limits reset on restart and are per process.

## Reporting

Please report vulnerabilities privately to the maintainers rather than opening
a public issue.
