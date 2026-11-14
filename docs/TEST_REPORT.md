# Delivery test report

**Date:** 13 November 2026 · **Project:** shizz ai agent 0.1.0 beta

This report distinguishes actual local execution from mocked external services. Passing these checks does not establish production readiness, live paid-model quality, native Android compatibility or Sorani speech fluency.

## Results actually observed

| Check | Result | Scope |
|---|---|---|
| Python pytest | **74 passed**, 1 dependency deprecation warning | Real backend + HTTP/SSE adapters with mocked provider responses; no paid account used |
| Ruff lint | Passed | Python backend/tests |
| TypeScript | Passed `tsc -b` | Mobile client/API/voice source |
| Vite production build | Passed | Bundled React client, local fonts and native-compatible web assets |
| Capacitor Android sync | Passed | Generated native source and copied current production assets; **not a Gradle compile** |
| Go | **2 test functions passed**, `go vet` passed; binary compiled | IP/URL validation and public-web reader implementation |
| Rust | **4 tests passed**, release binary compiled | Bounded secret-pattern scanner; no third-party crates |
| Rust/Python parity | Passed within pytest | Same synthetic findings, line numbers and no returned token values |
| Public reading sanity check | Both Go and Python returned HTTP 200, title “Example Domain” | One harmless read from `https://example.com`; not a security scan |
| Browser smoke suite | **11 checks passed** | Real demo API, local scanning/proposals, safe Markdown and responsive UI |
| Mocked voice suite | **7 checks passed** | Fake peer/media objects and mocked SDP/tool replies; **not real voice/WebRTC** |
| Shell scripts | `bash -n` passed | Syntax only; fresh bootstrap and Android build not executed end-to-end |
| npm runtime advisory query | 0 reported runtime advisories at test time | `npm audit --omit=dev`; not a source audit or assurance against unknown issues |

### Backend cases include

Live-mode token requirements; authentication and redacted errors; blocked external calls in demo; system-role rejection; message/body bounds; Sorani character preservation; public/private IP ranges including NAT64/IPv6 transitions; credential-bearing/nonstandard URLs; DNS pinning and original TLS SNI; private redirect rejection; mixed public/private DNS rejection; extraction/truncation; secret-pattern redaction and bounds; exact-host authorization before network access; no redirect following for security checks; decimal-safe quoting and unsent status; CORS; rate limits; configured routing; no silent provider fallback; streamed output and error handling; all four adapter formats and model-list parsing; empty-provider output rejection; missing speech credentials and malformed SDP.

### Browser smoke checks (11)

1. Demo identity and unconfigured-provider state.
2. A Sorani streamed demo reply is explicitly labelled as prewritten/not AI.
3. Markdown remote images are not requested, even from user text.
4. Real backend-local secret scan produces a redacted report.
5. Decimal quote, unsent proposal and browser download export work.
6. Device token is absent from localStorage after saving preferences.
7. Demo search is blocked and no made-up sources appear.
8. No horizontal overflow on all six screens at **320, 360, 390, 768 and 1440 CSS pixels**.
9. Missing voice providers route to setup rather than simulating microphone activity.
10. Sorani navigation toggle works.
11. No uncaught browser page errors during this suite.

### Explicitly mocked voice checks (7)

1. Tool requests wait for user approval before any outgoing request.
2. An approved search request executes once.
3. A denied search request does not execute and returns denial to the model channel.
4. End-call stops mocked tracks and closes the mocked peer.
5. Native background event stops capture.
6. A microphone permission result arriving after cancellation is cleaned up.
7. Audio elements are removed and no uncaught errors occur.

These use synthetic media/peer objects and fake capability/SDP responses. They establish UI/control-flow behavior, **not a successful connection to OpenAI, Google, ElevenLabs, a microphone or a physical phone**.

## Known warning

The installed Starlette TestClient emitted a deprecation warning about its HTTPX compatibility layer, recommending `httpx2`. Tests still passed on the versions below. Review/pin the test client and provider HTTP dependencies together before upgrading; this warning is not suppressed or hidden.

## Test environment

Linux x86-64 sandbox, Python 3.13.18, Node.js 20.20.2, npm 10.8.2. Go compiler 1.27.4 and Rust compiler 1.100.0 were installed for local helper tests. Project sources target Go 1.23+ and Rust edition 2021; the older Docker builder versions were not separately exercised.

Observed Python packages: FastAPI 0.162.6, Starlette 1.10.0, HTTPX 0.28.1, Pydantic 2.14.3, Uvicorn 0.54.0, pytest 9.0.3, Ruff 0.17.5, Beautiful Soup 4.15.0, google-auth 2.62.2. Client build uses Vite 6.4.6, TypeScript 5.8.3 and Capacitor 7.6.10. npm versions are locked in the included package-lock; Python requirements are range-bounded and should be pinned/reviewed for a production deployment.

## Not performed — do not infer success

- The two reference files: unavailable; no review or extraction was performed.
- Live paid-model, model availability, search-account, Google STT, ElevenLabs TTS or Realtime account validation.
- Native-speaker Sorani STT/understanding/TTS evaluation or measured voice latency.
- Real microphone/WebRTC media transport, speaker/Bluetooth/headset routes or real-device interruption tests.
- Android Gradle compilation, emulator/device install, release signing, CI execution or store submission.
- Docker image build/compose deployment, TLS/domain provisioning or fresh-machine setup end-to-end.
- Independent penetration test, exhaustive threat model, comprehensive dependency/source audit or production capacity/billing tests.
- Any third-party cybersecurity scan, proposal sending, payment, earnings or account creation.

## Reproduce

```bash
bash scripts/bootstrap.sh --dev
bash scripts/build-workers.sh
bash scripts/check.sh
bash scripts/dev.sh
# In another terminal, optionally install Playwright and its browser/dependencies:
python -m pip install playwright
python -m playwright install chromium
python scripts/browser_smoke.py
python scripts/voice_mock_smoke.py
```

Some systems also need browser system libraries (`python -m playwright install-deps chromium`, reviewed by the operator). The browser tests expect the default local demo on port 5173. The native parity test is skipped if you intentionally do not compile Rust. See SORANI_EVALUATION.md and ANDROID.md for the work still needed before real use.
