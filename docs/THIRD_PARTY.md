# Third-party components and notices

Original project code is MIT-licensed. The source depends on third-party libraries and build tools that retain their own licenses, notices and terms; inclusion here does not grant API access or ownership of any provider's models/voices.

Key components: React/React DOM, Vite, TypeScript, Capacitor and its Browser/Filesystem/Share plugins, lucide-react, react-markdown, FastAPI/Starlette, Pydantic, HTTPX, Uvicorn, Beautiful Soup, python-dotenv, python-multipart, Google Auth, Requests, pytest and Ruff. Go and Rust helpers use their standard libraries; the Rust scanner has no third-party crate dependencies.

Bundled web fonts:
- Inter Variable, distributed through `@fontsource-variable/inter` (SIL Open Font License).
- Noto Sans Arabic Variable, distributed through `@fontsource-variable/noto-sans-arabic` (SIL Open Font License).

The font license copies are included under `docs/licenses/`. Java/Gradle/Android wrapper/template files retain their upstream headers and licenses where present. npm dependencies are reproducible through `mobile/package-lock.json`; inspect package-level LICENSE/NOTICE files when distributing a compiled app. API-service names and product marks belong to their respective owners. This app is not endorsed by or officially affiliated with those providers.

No voice was cloned, no paid API account was created, and no provider credentials are included. A user-selected voice must be licensed/consented for the user's intended use.
