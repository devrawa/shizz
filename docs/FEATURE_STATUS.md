# Feature status and non-goals

## Implemented and locally exercised

- Responsive React/TypeScript interface; generated/synced Capacitor Android source.
- Sorani/English response preference, RTL-aware chat and bundled Noto Sans Arabic font. Key navigation labels and composer have a Sorani toggle; the **entire interface is not fully localized**.
- Clearly labelled prewritten demo, distinct from model output; demo external-service endpoints are blocked.
- NDJSON streaming orchestration, cancellation and source events.
- Four provider adapters (OpenAI, Anthropic, Gemini, compatible), plus OpenAI Chat Completions compatibility option. HTTP/SSE tests use mocks, not paid accounts.
- Account model-list parsing, manual IDs and explicit profile routing.
- Brave/Tavily integration code; public page extraction with byte/text caps and source-labelled research orchestration.
- Go fetchguard and Python IP-pinned fetcher. Both were exercised against the public example.com page; malicious URL/DNS patterns were tested without attacking any service.
- Rust/Python secret-pattern scanners, redacted findings, bounded input/output and parity tests.
- Authorized-header enforcement and report construction (network security target calls are mocked; no third-party security scan was performed).
- Decimal-safe English/Sorani unsent proposal generation and browser export.
- Request bounds, authorization, CORS, single-process rate limits and sanitized model error handling.

## Implemented integration paths, but not validated with live paid services

- Real chat responses and latest/strongest model availability/quality.
- Current search results from an authenticated search API and model-generated citation correctness.
- Google Sorani STT V2, ElevenLabs Sorani TTS.
- Sorani silence-delimited conversational pipeline and physical-phone audio playback.
- Direct Realtime WebRTC provider connection, network interruption behavior, paid function-call execution and native-speaker Sorani quality.

The interface reports **configured**, not **verified**, based on settings. Credential availability, provider regions, quotas, model access and quality must be tested by the owner. Browser tests may use explicitly mocked capabilities/SDP to exercise lifecycle and approval UI; these are not live speech-service tests.

## Not included / not claimed

- The two unavailable reference files, their contents or a fabricated review.
- A signed or unsigned precompiled APK/AAB, store publication or an executed Gradle/Android CI build.
- A hosted backend, purchased accounts, provider credits, subscriptions or API keys.
- Model weights, training/fine-tuning, guaranteed Sorani fluency or perfect understanding.
- Guaranteed latency, throughput, source truth, earnings or universal “do everything” capability.
- Full browser GUI automation, JavaScript rendering, authenticated browsing, arbitrary downloads, file management or an unrestricted terminal.
- Autonomous exploitation, malware, credential theft, unrestricted shell execution or network-wide scanning.
- Automatically sending proposals, contacting clients, receiving payments, trading, betting, account creation or investment management.
- Multi-tenant login/accounts, persistent long-term memory, a general plugin marketplace or production-grade distributed billing/quotas.
- Verified local-device biometrics/secure persistent token storage; the current token deliberately stays in session memory.
- C++ implementation; Rust was selected from the requested alternative.

## Speed strategy

Stream text as it arrives; cap context, output tokens, fetched bytes and tool fan-out; use native workers for bounded I/O/scanning; route profiles explicitly to a faster or deeper model chosen by the administrator. Realtime audio avoids waiting for the full STT→LLM→TTS pipeline. No paid-service latency numbers are invented. Use a nearby HTTPS server, measure first-token/audio latency, and set budgets before raising caps.
