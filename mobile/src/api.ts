import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type Provider =
  | "auto"
  | "openai"
  | "anthropic"
  | "gemini"
  | "compatible";
export type Profile = "fast" | "balanced" | "deep";
export type Settings = {
  base: string;
  token: string;
  provider: Provider;
  model: string;
  profile: Profile;
  language: "ckb" | "en" | "match";
  glossary: string;
};
export type Source = {
  id: number;
  title: string;
  url: string;
  snippet?: string;
  read_status?: string;
};
export type Health = {
  mode: "demo" | "live";
  version: string;
  auth_required: boolean;
  providers: { id: string; configured: boolean; default_model: string }[];
  features: {
    search: boolean;
    stt: boolean;
    tts: boolean;
    realtime: boolean;
    header_checks: boolean;
    local_tools: boolean;
  };
  workers: { go: boolean; rust: boolean };
};
export type Event = {
  type: string;
  text?: string;
  message?: string;
  demo?: boolean;
  provider?: string;
  model?: string;
  sources?: Source[];
  elapsed_ms?: number;
};
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatBody = {
  messages: ChatMessage[];
  provider: Provider;
  model: string;
  profile: Profile;
  language: Settings["language"];
  research: boolean;
  glossary: string;
};

export function loadSettings(): Settings {
  let saved: Partial<Settings> = {};
  try {
    saved = JSON.parse(localStorage.getItem("shizz.preferences") || "{}");
  } catch {
    /* Fresh settings. */
  }
  return {
    base: saved.base || import.meta.env.VITE_API_BASE_URL || "",
    token: "",
    provider: saved.provider || "auto",
    model: saved.model || "",
    profile: saved.profile || "balanced",
    language: saved.language || "ckb",
    glossary: saved.glossary || "",
  };
}
export function saveSettings(value: Settings) {
  const { token: _token, ...publicSettings } = value;
  localStorage.setItem("shizz.preferences", JSON.stringify(publicSettings)); // Never persist access tokens or provider keys.
}

export function api(config: Settings) {
  function path(endpoint: string) {
    let base = config.base.trim().replace(/\/$/, "");
    if (base) {
      const parsed = new URL(base);
      if (parsed.username || parsed.password || parsed.search || parsed.hash)
        throw new Error(
          "Backend URL must not contain credentials, a query or a fragment.",
        );
      const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
      if (
        parsed.protocol !== "https:" &&
        !(local && !Capacitor.isNativePlatform() && parsed.protocol === "http:")
      )
        throw new Error("Use an HTTPS backend URL.");
      base = base.replace(/\/$/, "");
    } else if (Capacitor.isNativePlatform())
      throw new Error(
        "Enter your deployed HTTPS backend URL in Settings first.",
      );
    return base + endpoint;
  }
  const auth = (): Record<string, string> =>
    config.token ? { Authorization: `Bearer ${config.token}` } : {};
  async function checked(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(path(endpoint), {
      ...options,
      headers: { ...auth(), ...options.headers },
    });
    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const data = await response.json();
        detail = typeof data.detail === "string" ? data.detail : detail;
      } catch {
        /* No provider body is exposed. */
      }
      throw new Error(detail);
    }
    return response;
  }
  async function json<T>(
    endpoint: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const r = await checked(endpoint, {
      method: body === undefined ? "GET" : "POST",
      signal,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    return r.json();
  }
  async function chat(
    body: ChatBody,
    onEvent: (event: Event) => void,
    signal?: AbortSignal,
  ) {
    const r = await checked("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!r.body)
      throw new Error(
        "Streaming is unavailable in this WebView. Update Android System WebView.",
      );
    const reader = r.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    const parse = (line: string) => {
      if (line.trim()) onEvent(JSON.parse(line));
    };
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        lines.forEach(parse);
      }
      buffer += decoder.decode();
      parse(buffer);
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  return {
    json,
    chat,
    health: () => json<Health>("/api/health"),
    realtime: async (sdp: string, signal: AbortSignal) =>
      (
        await checked("/api/voice/realtime", {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: sdp,
          signal,
        })
      ).text(),
    transcribe: async (blob: Blob, signal?: AbortSignal) => {
      const form = new FormData();
      form.append(
        "audio",
        blob,
        blob.type.includes("mp4") ? "turn.mp4" : "turn.webm",
      );
      return (
        await checked("/api/voice/transcribe", {
          method: "POST",
          body: form,
          signal,
        })
      ).json() as Promise<{ text: string }>;
    },
    speak: async (text: string, language: "ckb" | "en", signal?: AbortSignal) =>
      (
        await checked("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, language }),
          signal,
        })
      ).blob(),
  };
}

export function chatBody(
  settings: Settings,
  messages: ChatMessage[],
  research = false,
): ChatBody {
  return {
    messages: messages.slice(-30),
    provider: settings.provider,
    model: settings.model,
    profile: settings.profile,
    language: settings.language,
    research,
    glossary: settings.glossary,
  };
}

export async function openLink(value: string) {
  const u = new URL(value);
  if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
    throw new Error("Unsafe link blocked.");
  if (Capacitor.isNativePlatform()) await Browser.open({ url: u.href });
  else window.open(u.href, "_blank", "noopener,noreferrer");
}

export async function exportText(name: string, text: string) {
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({
        title: name,
        url: file.uri,
        dialogTitle: "Export from shizz ai agent",
      });
    } finally {
      await Filesystem.deleteFile({
        path: name,
        directory: Directory.Cache,
      }).catch(() => {});
    }
  } else {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
