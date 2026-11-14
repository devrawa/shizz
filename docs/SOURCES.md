# Technical sources and currency

Prepared 13 November 2026. These are public provider/tool documents, not the two missing user reference files. Model IDs, language support, region availability and billing can change. The implementation uses configurable IDs and account discovery rather than freezing an unverifiable “most powerful models” list.

- **OpenAI WebRTC guide:** documents backend SDP exchange through `/v1/realtime/calls`, trusted server credentials, browser media/data channels, and (at preparation time) the `gpt-realtime-2.1` example. [OpenAI WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?voice-api=realtime)
- **OpenAI speech recognition:** supported-language quality is not universal; Sorani performance should not be assumed from a multilingual model name. [2](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)
- **Google Cloud STT V2 language matrix:** lists Central Kurdish (Iraq), `ckb-IQ`, for specified region/Chirp combinations. [1](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages)
- **ElevenLabs Eleven v4:** documents `eleven_v4`, `eleven_v4_turbo`, model tradeoffs, and Sorani `ckb` language support. Exact voice quality still needs evaluation. [1](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4)
- **Claude model discovery:** account-available `/v1/models`; discovery is not a performance ranking. [1](https://platform.claude.com/docs/en/api/models/list)
- **Claude streaming:** Messages SSE and `content_block_delta`/`text_delta` events. [2](https://platform.claude.com/docs/en/build-with-claude/streaming)
- **Gemini API methods:** model listing and `streamGenerateContent` endpoints. [1](https://ai.google.dev/api/all-methods)
- **Capacitor Android:** native Android project creation, syncing, Android Studio/run workflow. The project pins Capacitor 7.6.10 for its Node 20 baseline; the current documentation may describe a newer major version. [Capacitor Android](https://capacitorjs.com/docs/android)

Search-engine integration endpoints used by the implementation are Brave `/res/v1/web/search` and Tavily `/search`; confirm current provider API contracts and account permissions before deployment. They were not authenticated or billed during delivery testing.

No supplied reference files were read. Provider integrations are implemented but unvalidated against the user's accounts, and no claim of paid-model quality, live voice fluency, autonomous earnings or complete pentesting is supported by these sources.
