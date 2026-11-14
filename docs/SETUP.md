# Setup: from demo to your own live agent

## 1. Understand where it runs

The Android app is a client. Your private **backend server** runs Python and optional Go/Rust helpers. Model, search and speech providers run remotely. This is not an offline, all-models-on-your-phone package. Internet access, accounts, billing availability in your region and an HTTPS server are needed for the connected features. Check providers' current regional availability and terms yourself; no geographic access is assumed.

Local development uses Python 3.11+ (tested here on 3.13), Node.js 20+, npm, and Linux/macOS/WSL Bash. Native workers use Go 1.23+ and stable Rust (optional). The Android build uses JDK 21 + Android SDK 35.

## 2. Run the local demo

From the extracted folder:

```bash
bash scripts/bootstrap.sh --dev
bash scripts/dev.sh
```

Bootstrap creates `.venv`, installs Python and npm dependencies, creates `.env` without overwriting an existing file, generates a private access token, and builds workers when their compilers are available. The generated token is **not printed**. Keep `.env` private.

The browser UI is `http://localhost:5173`; Vite proxies `/api` to the backend. In browser code there is no hardcoded localhost backend URL. The proxy's loopback address is server-side only. Demo mode has prewritten, labelled chat text and real backend-local scanning/quoting; external integrations are blocked.

On Windows use WSL or perform the equivalent Python/npm steps in a shell you understand. If virtualenv support is missing on Linux, install your distribution's Python venv package.

## 3. Choose at least one chat provider

Edit the real `.env` **on the backend only**. Set a provider key and a model ID available to your account. Model IDs change; this package deliberately does not hardcode a universal “best” chat model.

- OpenAI: `OPENAI_API_KEY`, `OPENAI_MODEL`. Default transport is `OPENAI_API_MODE=responses` with `store=false`. Set `chat_completions` only for a compatible chat model when needed.
- Anthropic: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.
- Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`.
- Additional aggregator/local service: `COMPATIBLE_BASE_URL` including `/v1`, optional `COMPATIBLE_API_KEY`, and `COMPATIBLE_MODEL`. It must implement streaming Chat Completions. The administrator alone controls this trusted URL. A local, unauthenticated model server must not be exposed publicly.

Then set your routes, for example `BALANCED_PROVIDER=anthropic`. A route's model uses `BALANCED_MODEL` if set, otherwise the provider's default. `FAST_PROVIDER/FAST_MODEL` and `DEEP_PROVIDER/DEEP_MODEL` are independent. They default to OpenAI until changed. These labels do not themselves configure reasoning effort, benchmark models or reduce network latency.

To discover IDs: enable live mode with your key and device token, choose that specific provider in app Settings, enter the token, and press **Load available models**. The list is account-specific, first-page/limited, and not ranked. Some APIs list non-chat models; use the provider's model docs or a known chat ID. Manual IDs are supported. No automatic cross-provider fallback sends your data elsewhere unexpectedly.

The compatible adapter can access other model vendors through your chosen aggregator if its API supports them. Only one additional compatible base is configured in this version.

## 4. Enable live mode safely

1. Make sure `APP_ACCESS_TOKEN` is a randomly generated value of at least 32 characters. To generate one yourself:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(36))"
```

2. Store it privately; it authenticates your single-owner app to the backend. It is **not** a provider key. This version uses one owner token, not multi-user accounts.
3. Set `DEMO_MODE=false` and restart the backend. It refuses to start live with a short/missing token.
4. Put a trusted TLS reverse proxy or an HTTPS hosting service in front of port 8000. Do not send tokens over plain HTTP, expose a model server directly, or use the Vite dev server as production hosting.
5. In Android Settings, enter the deployed URL, e.g. `https://your-host.example` (without `/api`), and the device token. No private keys go in the mobile project. The token is kept in memory, so you re-enter it after app restarts.
6. Choose your provider/model and save. A green configuration indicator is not proof of provider connectivity: try a short harmless chat request.

The packaged Android origin is `https://localhost`; this is the app's own WebView origin, **not the server it calls**. It is allowed by the backend's CORS list. If you deploy a browser frontend on a separate domain, explicitly add its origin to `ALLOWED_ORIGINS`. Never change it to an unrestricted wildcard to fix errors.

## 5. Add search

Set either `BRAVE_SEARCH_API_KEY` or `TAVILY_API_KEY`. Brave is used if both are configured. Then restart. Use Research for raw results, Read a URL for text extraction, or enable Web research on an explicit chat turn for cited synthesis.

Chat research sends up to 500 characters from the last user message as its query. **Do not enable research on confidential input.** At most five results and three source-page fetches are used. Page reads cap decoded body size at 1.5 MB and extracted text at 28,000 characters; research context uses shorter excerpts. A page marked snippet-only was not fully read. No page scripts, authenticated sites, PDFs, screenshots or browser GUI automation are implemented.

## 6. Set up Sorani speech

### Recognition: Google Cloud Speech-to-Text V2

Enable the Speech-to-Text API and billing in your cloud project. Use workload identity / attached service credentials in production, with least-privilege speech permissions, or application default credentials for local testing. Set:

```dotenv
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_SPEECH_LOCATION=us-central1
GOOGLE_SPEECH_MODEL=chirp_2
```

The request uses `languageCodes: ["ckb-IQ"]`, `autoDecodingConfig`, and the V2 short-turn `recognize` endpoint. Check that the language/model/region combination remains supported. [1](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages) Each recorded turn is bounded to 45 seconds in the app and 10 MB on the backend. Google credentials remain server-side. If using a service-account JSON locally, set `GOOGLE_APPLICATION_CREDENTIALS` to a private absolute path outside this project; never commit or bundle it.

For a container, a credential JSON path on the host does not automatically exist inside the container: use workload identity, or explicitly mount a private file read-only and set the **container-side** path. The supplied compose file does not mount credentials.

### Speaking: ElevenLabs

Configure a voice you are permitted to use:

```dotenv
ELEVENLABS_API_KEY=your-private-server-key
ELEVENLABS_VOICE_ID=your-permitted-voice-id
ELEVENLABS_MODEL=eleven_v4_turbo
```

This adapter sends `language_code=ckb` for Sorani. At preparation time ElevenLabs documented Sorani support for v4 and v4 Turbo; that is not a guarantee of pronunciation or access. Test the exact voice/model combination. [1](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4) Do not clone another person's voice without consent. Generated speech should be understood as AI-generated, not a human impersonation.

The **Sorani conversation** mode records until a pause, transcribes, generates text, plays synthesized speech, and then listens again. It is half-duplex, with a conservative simple RMS silence detector, not an advanced learned VAD. Noise and long pauses can cause early/late turns. Review ordinary voice notes before sending when accuracy matters. Speech synthesis currently waits for the whole text and audio response, so this mode is slower than Realtime. TTS input is capped at 3,500 characters.

### Direct WebRTC Realtime

Configure `OPENAI_API_KEY`, `REALTIME_MODEL` (default is the documented `gpt-realtime-2.1` at preparation time), and `REALTIME_VOICE`. This is independent from the chat-model selector. The server forwards the SDP offer plus its trusted session configuration to `/v1/realtime/calls`; no permanent provider key reaches the phone. The UI supports provider-side VAD, interruption, transcript events and search/read function-call approvals.

Sorani performance here is **experimental**; do not assume the separate transcription helper has documented high-quality Sorani support. Realtime input transcription uses `gpt-4o-mini-transcribe`; it is not the Google Sorani pipeline. Always compare it against native-speaker references before using it for important tasks.

Microphone use requires a secure context, Android permissions, an up-to-date WebView and user action. Audio autoplay or microphone permissions may be blocked in embedded preview frames; test in a standalone browser and a real Android build. A phone with speaker feedback, a Bluetooth route change or poor networking needs device QA. The app stops capture on page exit/background; ten minutes and six tool requests are app-side session limits, not a provider billing guarantee. Set provider budgets.

## 7. Enable authorized security checks

`SECURITY_ALLOWED_HOSTS` is empty by default. An administrator must list only exact hosts you own or are authorized to test. The UI must also declare the same hostname and confirm written authorization. No wildcards or redirect following are used for network security checks.

Example configuration format only: `SECURITY_ALLOWED_HOSTS=your-authorized-host.example`.

The tool makes one GET and evaluates header presence, not a complete pentest or proof of exploitability. Secret-pattern scanning reads pasted text only and returns locations/type hints, never matching values. False positives and false negatives are expected. Rotate any real exposed credentials; do not rely on this scanner as the only review.

## 8. Production and cost checklist

- HTTPS, private owner token, secret manager, least-privilege provider credentials.
- Container/non-root deployment, patched dependencies and OS, outbound firewall if needed.
- Provider-level budget limits/alerts; a token cap and request limiter do not guarantee a dollar ceiling.
- Rate limiting: 45 authenticated/tool requests per peer IP per minute, four concurrent chat streams per process. Behind a proxy this can collapse all clients into one IP. The supplied launch command ignores forwarded IP headers intentionally. Configure trusted proxies and a shared production limiter if needed; do not blindly trust `X-Forwarded-For`.
- Disable proxy buffering for `/api/chat` NDJSON streams and give them suitable timeouts.
- Do not log request bodies, audio, tokens or provider error bodies. The launch scripts disable access logging, but your reverse proxy/hosting platform may have its own logs.
- Understand provider data-retention settings and contractual terms. `store=false` is not a general zero-retention promise.
- Sorani native-speaker evaluation and real-device permission, speaker, interruption and lifecycle tests.
- A production sign-off is still required; this beta is not an audited managed service.

Optional API container:

```bash
cp .env.example .env  # only if you have not already created it; then edit securely
# set a private token and desired mode/provider values before use
docker compose up --build -d
```

The compose file binds the host port to `127.0.0.1:8000`, drops capabilities, and runs read-only/non-root. It does not provision a domain, TLS certificate or frontend hosting. Add a trusted HTTPS proxy appropriate to your host. The Docker build recipe has not been executed in the delivery sandbox; validate it before deployment.
