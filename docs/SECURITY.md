# Security and privacy model

This is a single-owner beta, not a formally audited security product. Use it only with systems you own or have written permission to test.

## Trust boundaries

1. **Phone/browser client:** untrusted requests; no provider API keys. The device access token stays in React memory and is not persisted to local storage. Nonsecret preferences and optional vocabulary are stored on the device. Source/HTML never contains a real token.
2. **Backend:** trusted administrator configuration, provider secrets and explicit host scope. Live startup refuses a short/missing owner token. All operational endpoints except health are protected in live mode with constant-time token comparison. Demo operational endpoints are rate-limited, and all external-service operations are disabled.
3. **Models and external services:** may be wrong and have their own policies. The backend does not supply its provider keys in model instructions or web context. Keys are only HTTP authentication to their configured provider.
4. **Web evidence:** explicitly untrusted. Search snippets/pages cannot grant authorization or run commands. The model is instructed not to follow page instructions. This reduces risk but does **not** prove immunity to prompt injection or incorrect citations.
5. **Native workers:** fixed administrator-controlled executables, invoked with argument arrays, never `shell=True`. Only a small environment allowlist is inherited; API secrets are not passed to workers. A worker rejection fails closed rather than trying another fetch engine. Protect the worker executable directory against untrusted writes.

## Network safeguards

- Only HTTP/HTTPS and standard ports are accepted; userinfo, local hostnames, control/whitespace/backslash URL characters and nonpublic targets are blocked.
- DNS answers must all be public. Private, loopback, reserved, multicast and selected transition/NAT64 ranges are rejected.
- Go resolves/validates inside its dialer, then connects to the validated literal IP. TLS validates the original hostname.
- Python connects to the validated IP and supplies the original hostname as TLS SNI + Host, avoiding a separate DNS lookup between checking and dialing.
- Redirect destinations are revalidated (maximum bounded chain). Network security checks do **not** follow redirects at all.
- No environment proxy is trusted, no browser cookies or credentials are forwarded, and no page scripts execute. The reader does not bypass authentication or fetch arbitrary file schemes.
- Page body size, extraction size, worker timeout and research fan-out are capped.

These protections are engineering controls, not a complete substitute for an outbound firewall. A hostile public service can still return deceptive content. Administrators should review egress restrictions and dependency updates before exposing a service publicly.

## Security tool scope

`SECURITY_ALLOWED_HOSTS` is an administrator-only exact-host set; no API allows a model or user request to change it. A request must match the declared scope, match this set and confirm authorization. This is a scope control, **not independent proof of ownership**: the administrator must actually verify authorization.

Header review uses one GET with no cookies, no authentication headers, no port scanning and no exploit traffic. A missing header is a review hint, not proof of vulnerability. It does not perform a complete TLS audit, directory scan, exploit test or compliance certification.

Secret scanning examines a short list of token/private-key patterns in pasted text. It does not execute text, open arbitrary files or send snippets to an LLM. It returns static labels and line numbers, not values. It is not a substitute for a comprehensive reviewed secret scanner; handle false positives/negatives and rotate real exposed credentials.

## Voice and external actions

- The microphone starts only from a user action. Tracks and playback are stopped on page exit, app background/visibility changes, session end and handled connection/setup errors.
- Sorani pipeline audio goes through the backend to Google; text goes to the selected model and TTS provider. Realtime media goes directly to the voice provider after the SDP exchange.
- The UI identifies the voice as AI-generated. Only use a voice you have permission to use, and obtain consent before recording others.
- Realtime search/read requests require per-request user approval showing the query or URL. The tool allowlist does not contain shell, file modification, purchases, outreach or exploit execution. There are app-side session/tool caps; provider budgets remain necessary.
- Work proposals are unsent drafts. There are no trading, payment, account-creation or automatic client-contact endpoints.

## Storage and disclosure

There is no database, chat-memory file, training ingestion or automatic transcript persistence. App exports happen only on explicit request. Native exports temporarily use app cache and are removed after the share action; shared copies are outside this app's control. The browser and OS can have their own caches, crash logs or forensic artifacts, so do not treat “no automatic persistence” as perfect erasure.

The minimal server does not intentionally log request content, audio, secrets or provider error bodies; the supplied uvicorn commands disable access logging. Hosting, reverse proxy, OS, cloud credentials tooling and providers may still retain data. Review their policies. OpenAI Responses uses `store=false`, which is **not** an assertion of zero retention across all services.

The Android client disables app backup and cleartext/mixed content, uses system CA trust, has no blanket storage permission and includes no background microphone service. App navigation is local; external article links use an explicit user-opened system browser. Markdown raw HTML does not execute and remote Markdown images are deliberately not loaded.

## What to improve before multi-user production

- Per-user authentication, token rotation/revocation, session and user quotas, secure optional token storage.
- A shared rate limiter, provider-specific usage/cost accounting, concurrency control for all paid services and server-enforced session budgets.
- Strict production frontend CSP/TLS headers, host routing and trusted-proxy configuration.
- Credential rotation, dependency pinning/auditing, automated release signing, independent security review and device lifecycle tests.
- Native-speaker accuracy checks, red-team prompt-injection/citation tests, provider data-processing agreements and privacy notices appropriate to your jurisdiction.

Report a problem privately to your own maintainer/operator; no public disclosure contact or bounty is invented by this project.
