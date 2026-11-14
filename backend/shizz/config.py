from dataclasses import dataclass, field
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env", override=False)


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes"}


@dataclass
class Settings:
    demo: bool = field(default_factory=lambda: env_bool("DEMO_MODE", True))
    token: str = field(default_factory=lambda: os.getenv("APP_ACCESS_TOKEN", ""))
    openai_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    anthropic_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    gemini_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    openai_api_mode: str = field(default_factory=lambda: os.getenv("OPENAI_API_MODE", "responses"))
    compatible_key: str = field(default_factory=lambda: os.getenv("COMPATIBLE_API_KEY", ""))
    compatible_base: str = field(default_factory=lambda: os.getenv("COMPATIBLE_BASE_URL", ""))
    models: dict = field(
        default_factory=lambda: {
            "openai": os.getenv("OPENAI_MODEL", ""),
            "anthropic": os.getenv("ANTHROPIC_MODEL", ""),
            "gemini": os.getenv("GEMINI_MODEL", ""),
            "compatible": os.getenv("COMPATIBLE_MODEL", ""),
        }
    )
    routes: dict = field(
        default_factory=lambda: {
            p: (os.getenv(f"{p.upper()}_PROVIDER", "openai"), os.getenv(f"{p.upper()}_MODEL", ""))
            for p in ("fast", "balanced", "deep")
        }
    )
    search_key: str = field(default_factory=lambda: os.getenv("BRAVE_SEARCH_API_KEY", ""))
    tavily_key: str = field(default_factory=lambda: os.getenv("TAVILY_API_KEY", ""))
    security_hosts: set = field(
        default_factory=lambda: {
            h.strip().lower().encode("idna").decode()
            for h in os.getenv("SECURITY_ALLOWED_HOSTS", "").split(",")
            if h.strip()
        }
    )
    google_project: str = field(default_factory=lambda: os.getenv("GOOGLE_CLOUD_PROJECT", ""))
    google_location: str = field(default_factory=lambda: os.getenv("GOOGLE_SPEECH_LOCATION", "us-central1"))
    google_model: str = field(default_factory=lambda: os.getenv("GOOGLE_SPEECH_MODEL", "chirp_2"))
    eleven_key: str = field(default_factory=lambda: os.getenv("ELEVENLABS_API_KEY", ""))
    eleven_voice: str = field(default_factory=lambda: os.getenv("ELEVENLABS_VOICE_ID", ""))
    eleven_model: str = field(default_factory=lambda: os.getenv("ELEVENLABS_MODEL", "eleven_v4_turbo"))
    realtime_model: str = field(default_factory=lambda: os.getenv("REALTIME_MODEL", "gpt-realtime-2.1"))
    realtime_voice: str = field(default_factory=lambda: os.getenv("REALTIME_VOICE", "marin"))
    max_tokens: int = field(default_factory=lambda: min(4096, max(128, int(os.getenv("MAX_OUTPUT_TOKENS", "1200")))))
    origins: list = field(
        default_factory=lambda: [
            x.strip()
            for x in os.getenv("ALLOWED_ORIGINS", "https://localhost,http://localhost,http://localhost:5173").split(",")
            if x.strip()
        ]
    )
    fetch_binary: str = field(default_factory=lambda: os.getenv("FETCHGUARD_BIN", str(ROOT / "workers/bin/fetchguard")))
    secret_binary: str = field(
        default_factory=lambda: os.getenv("SECRETGUARD_BIN", str(ROOT / "workers/bin/secretguard"))
    )

    def keys(self) -> dict:
        return {
            "openai": self.openai_key,
            "anthropic": self.anthropic_key,
            "gemini": self.gemini_key,
            "compatible": self.compatible_key,
        }

    def ready(self, provider: str) -> bool:
        return bool(self.keys().get(provider)) or (provider == "compatible" and bool(self.compatible_base))
