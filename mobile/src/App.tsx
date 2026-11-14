import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import Markdown from "react-markdown";
import {
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileKey2,
  Globe2,
  Layers,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  Mic,
  MicOff,
  Plus,
  Radio,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Square,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  api,
  chatBody,
  exportText,
  loadSettings,
  openLink,
  saveSettings,
} from "./api";
import type { ChatMessage, Health, Settings, Source } from "./api";
import { captureTurn, playBlob, startRealtime } from "./voice";
import type { ToolRequest, VoiceLine } from "./voice";

type Page = "chat" | "voice" | "research" | "security" | "work" | "settings";
type ViewMessage = ChatMessage & {
  id: string;
  meta?: string;
  demo?: boolean;
  sources?: Source[];
  error?: string;
  ms?: number;
};
type Toast = (text: string) => void;
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
const isAbort = (e: unknown) =>
  e instanceof DOMException && e.name === "AbortError";
const nav: { id: Page; label: string; ckb: string; icon: LucideIcon }[] = [
  { id: "chat", label: "Assistant", ckb: "گفتوگۆ", icon: MessageSquare },
  { id: "voice", label: "Live voice", ckb: "دەنگی ڕاستەوخۆ", icon: AudioLines },
  { id: "research", label: "Research", ckb: "گەڕان", icon: Globe2 },
  { id: "security", label: "Security lab", ckb: "ئاسایش", icon: Shield },
  {
    id: "work",
    label: "Income studio",
    ckb: "کار و داهات",
    icon: BriefcaseBusiness,
  },
  {
    id: "settings",
    label: "Models & settings",
    ckb: "ڕێکخستنەکان",
    icon: Settings2,
  },
];
const starters = [
  {
    icon: Shield,
    label: "Make security simpler",
    text: "Explain passkeys in natural Sorani Kurdish, with a short example.",
    detail: "Learn, defend, and build safely",
    color: "green",
  },
  {
    icon: Globe2,
    label: "Find a clearer answer",
    text: "Help me research a topic. First ask what I want to learn and how current the information needs to be.",
    detail: "Search with sources, not guesses",
    color: "blue",
  },
  {
    icon: Code2,
    label: "Turn an idea into code",
    text: "Help me design a secure Android app. Ask me for the requirements first and explain in Sorani.",
    detail: "Think through your next project",
    color: "purple",
  },
  {
    icon: BriefcaseBusiness,
    label: "Put your skills to work",
    text: "Help me plan an honest freelance service based on my skills. Ask about my experience and never promise income.",
    detail: "Plan useful services and proposals",
    color: "orange",
  },
];
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo ${small ? "small" : ""}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M70 24H39L25 50h34L45 76h16l15-27H42l13-12h15z" />
      </svg>
    </span>
  );
}
function Spinner() {
  return <LoaderCircle size={16} className="spin" />;
}
function Notice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: string;
}) {
  return (
    <div className={`notice ${kind}`}>
      <LockKeyhole size={15} />
      <span>{children}</span>
    </div>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Heading({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">
        <Icon size={14} />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function RichText({ text }: { text: string }) {
  return (
    <div className="markdown" dir="auto">
      <Markdown
        components={{
          img: ({ alt }) => (
            <span className="muted">
              [Image not loaded{alt ? `: ${alt}` : ""}]
            </span>
          ),
          a: ({ href, children }) => (
            <button
              className="inline-link"
              onClick={() => href && void openLink(href).catch(() => {})}
            >
              {children}
              <ExternalLink size={12} />
            </button>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
function SourceList({ sources }: { sources: Source[] }) {
  return (
    <div className="sources">
      {sources.map((s, i) => (
        <button
          key={s.url + i}
          className="source"
          onClick={() => void openLink(s.url).catch(() => {})}
        >
          <span className="source-number">{s.id}</span>
          <span>
            <b>{s.title || s.url}</b>
            <small>
              {s.url.replace(/^https?:\/\//, "").split("/")[0]}
              {s.read_status === "snippet_only" ? " · snippet only" : ""}
            </small>
          </span>
          <ArrowUpRight size={15} />
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("chat");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [health, setHealth] = useState<Health | null>(null),
    [connectionError, setConnectionError] = useState("");
  const [messages, setMessages] = useState<ViewMessage[]>([]),
    [draft, setDraft] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  const [web, setWeb] = useState(false),
    [toast, setToast] = useState(""),
    [privacy, setPrivacy] = useState(false),
    [ui, setUi] = useState<"en" | "ckb">("en");
  const [speaking, setSpeaking] = useState("");
  const end = useRef<HTMLDivElement>(null),
    chatAbort = useRef<AbortController | null>(null),
    audioAbort = useRef<AbortController | null>(null);
  const notify: Toast = (text) => setToast(text);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let ignore = false;
    api(settings)
      .health()
      .then((h) => {
        if (!ignore) {
          setHealth(h);
          setConnectionError("");
        }
      })
      .catch((e) => {
        if (!ignore) {
          setConnectionError(errorText(e));
          setHealth(null);
        }
      });
    return () => {
      ignore = true;
    };
  }, [settings]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, page]);
  useEffect(
    () => () => {
      chatAbort.current?.abort();
      audioAbort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    audioAbort.current?.abort();
    setSpeaking("");
  }, [page]);
  useEffect(() => {
    const stopAudio = () => {
      audioAbort.current?.abort();
    };
    const visibility = () => {
      if (document.hidden) stopAudio();
    };
    window.addEventListener("shizz:background", stopAudio);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("shizz:background", stopAudio);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const patch = (id: string, value: Partial<ViewMessage>) =>
    setMessages((old) =>
      old.map((m) => (m.id === id ? { ...m, ...value } : m)),
    );
  async function send(value?: string) {
    const text = (value ?? draft).trim();
    if (!text || busy) return;
    const user: ViewMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const reply: ViewMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };
    const history = [
      ...messages
        .filter((m) => m.content && !m.error)
        .map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: text },
    ];
    setMessages((old) => [...old, user, reply]);
    setDraft("");
    setBusy(true);
    setStatus("Connecting");
    setPage("chat");
    const controller = new AbortController();
    chatAbort.current = controller;
    let full = "";
    try {
      await api(settings).chat(
        chatBody(settings, history, web),
        (event) => {
          if (event.type === "meta")
            patch(reply.id, {
              meta: `${event.provider} · ${event.model}`,
              demo: event.demo,
            });
          if (event.type === "status") setStatus(event.text || "Working");
          if (event.type === "sources")
            patch(reply.id, { sources: event.sources });
          if (event.type === "delta") {
            full += event.text || "";
            patch(reply.id, { content: full });
            setStatus("");
          }
          if (event.type === "error")
            throw new Error(event.message || "Provider error");
          if (event.type === "done") patch(reply.id, { ms: event.elapsed_ms });
        },
        controller.signal,
      );
    } catch (e) {
      if (isAbort(e)) {
        patch(reply.id, { meta: "Stopped by you" });
      } else patch(reply.id, { error: errorText(e) });
    } finally {
      setBusy(false);
      setStatus("");
      chatAbort.current = null;
    }
  }
  async function speak(message: ViewMessage) {
    if (speaking) {
      audioAbort.current?.abort();
      setSpeaking("");
      return;
    }
    const controller = new AbortController();
    audioAbort.current = controller;
    setSpeaking(message.id);
    try {
      const blob = await api(settings).speak(
        message.content.slice(0, 3500),
        settings.language === "en" ? "en" : "ckb",
        controller.signal,
      );
      await playBlob(blob, controller.signal);
    } catch (e) {
      if (!isAbort(e)) notify(errorText(e));
    } finally {
      setSpeaking("");
      audioAbort.current = null;
    }
  }
  const current = nav.find((n) => n.id === page)!;
  const isDemo = health?.mode === "demo";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage("chat")}>
          <Logo />
          <span>
            shizz
            <span className="brand-sub">
              ai agent<span className="beta">BETA</span>
            </span>
          </span>
        </button>
        <button
          className="new-chat"
          onClick={() => {
            if (busy) {
              notify("Stop the current answer before starting a new chat.");
              return;
            }
            audioAbort.current?.abort();
            setMessages([]);
            setDraft("");
            setPage("chat");
          }}
        >
          <Plus size={17} />
          {ui === "en" ? "New conversation" : "گفتوگۆی نوێ"}
          <span>＋</span>
        </button>
        <p className="nav-caption">YOUR WORKSPACE</p>
        <nav>
          {nav.slice(0, 5).map(({ id, label, ckb, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-label={ui === "en" ? label : ckb}
              onClick={() => setPage(id)}
            >
              <Icon size={18} />
              <span>{ui === "en" ? label : ckb}</span>
              {id === "voice" && <span className="nav-tag">LIVE</span>}
              {page === id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-card">
            <Shield size={19} />
            <b>Built with boundaries.</b>
            <p>Your keys stay on your server. You stay in control.</p>
            <button onClick={() => setPrivacy(true)}>
              Privacy & safety <ArrowUpRight size={13} />
            </button>
          </div>
          <nav>
            <button
              className={page === "settings" ? "active" : ""}
              onClick={() => setPage("settings")}
            >
              <Settings2 size={18} />
              <span>{ui === "en" ? "Models & settings" : "ڕێکخستنەکان"}</span>
            </button>
          </nav>
          <div className="edition">
            <span className="avatar">S</span>
            <span>
              <b>Personal workspace</b>
              <small>Android edition · v0.1</small>
            </span>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="mobile-brand">
              <Logo small />
            </span>
            <span className="breadcrumb-home">
              Workspace <ChevronRight size={13} />
            </span>
            <b>{ui === "en" ? current.label : current.ckb}</b>
          </div>
          <div className="top-actions">
            <span
              className={`connection ${health?.mode === "live" ? "connected" : ""}`}
            >
              <i />
              {connectionError
                ? "Server offline"
                : isDemo
                  ? "Local demo"
                  : health
                    ? "Server connected"
                    : "Connecting"}
            </span>
            <button
              className="language-toggle"
              onClick={() => setUi(ui === "en" ? "ckb" : "en")}
            >
              {ui === "en" ? "کوردی" : "EN"}
            </button>
            <button
              className="icon-button help"
              aria-label="About privacy and safety"
              onClick={() => setPrivacy(true)}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <div className={`page-content ${page === "chat" ? "chat-page" : ""}`}>
          {page === "chat" && (
            <>
              {messages.length === 0 ? (
                <div className="welcome">
                  <div className="welcome-badge">
                    <span />
                    <span>SORANI-FIRST INTELLIGENCE</span>
                    <Sparkles size={12} />
                  </div>
                  <h1 dir="rtl">
                    سڵاو، من شیزم<span>.</span>
                  </h1>
                  <h2>
                    Your ideas. Your language.
                    <br />
                    <span>A little more possible.</span>
                  </h2>
                  <p className="intro">
                    A thoughtful space to ask, explore, and build.
                    <br />
                    From your first question to your next big idea.
                  </p>
                  <button
                    className="voice-banner"
                    onClick={() => setPage("voice")}
                  >
                    <span className="voice-banner-icon">
                      <AudioLines size={21} />
                    </span>
                    <span>
                      <b>Let’s talk, in Sorani.</b>
                      <small>Explore live voice conversation</small>
                    </span>
                    <div className="mini-wave">
                      {[8, 17, 24, 13, 30, 20, 10, 21, 14].map((n, i) => (
                        <i key={i} style={{ height: n }} />
                      ))}
                    </div>
                    <ArrowUpRight size={18} />
                  </button>
                  <div className="starter-heading">
                    <span>A FEW PLACES TO START</span>
                    <Wand2 size={14} />
                  </div>
                  <div className="starter-grid">
                    {starters.map(
                      ({ icon: Icon, label, text, detail, color }) => (
                        <button
                          key={label}
                          className="starter"
                          onClick={() => void send(text)}
                        >
                          <div className={`starter-icon ${color}`}>
                            <Icon size={19} />
                          </div>
                          <h3>
                            {label}
                            <ArrowUpRight size={14} />
                          </h3>
                          <p>{detail}</p>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="conversation">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      className={`message ${message.role}`}
                    >
                      <div className="message-avatar">
                        {message.role === "assistant" ? (
                          <Logo small />
                        ) : (
                          <span>YOU</span>
                        )}
                      </div>
                      <div className="message-body">
                        <div className="message-top">
                          <b>
                            {message.role === "assistant"
                              ? "shizz ai agent"
                              : "You"}
                          </b>
                          {message.demo && (
                            <span className="demo-tag">LOCAL DEMO</span>
                          )}
                          {message.ms !== undefined && (
                            <small>
                              {(message.ms / 1000).toFixed(1)}s total
                            </small>
                          )}
                        </div>
                        {message.content ? (
                          <RichText text={message.content} />
                        ) : (
                          busy &&
                          !message.error && (
                            <div className="thinking">
                              <i />
                              <i />
                              <i />
                              <span>{status || "Thinking"}</span>
                            </div>
                          )
                        )}
                        {message.error && (
                          <div className="error-box">{message.error}</div>
                        )}
                        {message.sources && (
                          <SourceList sources={message.sources} />
                        )}{" "}
                        {message.role === "assistant" && message.content && (
                          <div className="message-tools">
                            <button
                              onClick={() =>
                                navigator.clipboard
                                  .writeText(message.content)
                                  .then(() => notify("Copied to clipboard."))
                                  .catch(() =>
                                    notify("Clipboard access was blocked."),
                                  )
                              }
                            >
                              <Copy size={13} />
                              Copy
                            </button>
                            <button onClick={() => void speak(message)}>
                              {speaking === message.id ? (
                                <Square size={13} />
                              ) : (
                                <AudioLines size={13} />
                              )}{" "}
                              {speaking === message.id
                                ? "Stop audio"
                                : "Read aloud"}
                            </button>
                            <small>
                              {message.demo
                                ? "Prewritten preview · not AI"
                                : message.meta}
                            </small>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                  <div ref={end} />
                </div>
              )}
              <div className="composer-wrap">
                {connectionError && (
                  <div className="composer-notice">
                    {connectionError}{" "}
                    <button onClick={() => setPage("settings")}>
                      Open settings <ArrowUpRight size={12} />
                    </button>
                  </div>
                )}
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <textarea
                    value={draft}
                    maxLength={16000}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      ui === "en"
                        ? "Ask anything. Start something."
                        : "بپرسە یان بیرۆکەیەک دروست بکە..."
                    }
                    aria-label="Message shizz ai agent"
                    dir="auto"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <div className="composer-bottom">
                    <div>
                      <button
                        type="button"
                        className={`web-toggle ${web ? "on" : ""}`}
                        onClick={() => {
                          setWeb(!web);
                          if (!web && !health?.features.search)
                            notify(
                              "Web research needs a configured search service. Demo answers never claim to have searched.",
                            );
                        }}
                      >
                        <Globe2 size={14} />
                        <span>Web research</span>
                        {web && <Check size={12} />}
                      </button>
                      <span className="composer-divider" />
                      <button
                        type="button"
                        className="model-toggle"
                        onClick={() => setPage("settings")}
                      >
                        <Layers size={14} />
                        <span>
                          {settings.profile[0].toUpperCase() +
                            settings.profile.slice(1)}
                        </span>
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <div>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label="Open voice conversation"
                        onClick={() => setPage("voice")}
                      >
                        <Mic size={18} />
                      </button>
                      {busy ? (
                        <button
                          type="button"
                          className="send-button"
                          aria-label="Stop answer"
                          onClick={() => chatAbort.current?.abort()}
                        >
                          <Square size={16} />
                        </button>
                      ) : (
                        <button
                          className="send-button"
                          type="submit"
                          disabled={!draft.trim()}
                          aria-label="Send message"
                        >
                          <ArrowUp size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                </form>
                <p className="composer-foot">
                  <LockKeyhole size={10} />
                  {isDemo
                    ? "Local demo · AI services are not connected."
                    : "AI can make mistakes. Verify important information."}
                  <span>Sorani / English</span>
                </p>
              </div>
            </>
          )}
          {page === "voice" && (
            <VoicePage
              settings={settings}
              health={health}
              notify={notify}
              onSettings={() => setPage("settings")}
              onToChat={(text) => {
                setDraft(text);
                setPage("chat");
              }}
            />
          )}
          {page === "research" && (
            <ResearchPage settings={settings} health={health} notify={notify} />
          )}
          {page === "security" && (
            <SecurityPage settings={settings} notify={notify} />
          )}
          {page === "work" && <WorkPage settings={settings} notify={notify} />}
          {page === "settings" && (
            <SettingsPage
              value={settings}
              health={health}
              error={connectionError}
              notify={notify}
              onSave={(next) => {
                saveSettings(next);
                setSettings({ ...next });
                notify(
                  "Settings saved. Your access token is held only for this session.",
                );
              }}
            />
          )}
        </div>
      </main>
      <nav className="mobile-nav">
        {nav.map(({ id, label, ckb, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={page === id ? "active" : ""}
            aria-label={label}
          >
            <Icon size={20} />
            <span>
              {ui === "ckb"
                ? ckb
                : id === "chat"
                  ? "Chat"
                  : id === "settings"
                    ? "Settings"
                    : id === "work"
                      ? "Work"
                      : label.replace(" lab", "")}
            </span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {privacy && (
        <div className="modal-backdrop" onClick={() => setPrivacy(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Privacy and safety"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close privacy details"
              onClick={() => setPrivacy(false)}
            >
              <X size={19} />
            </button>
            <Shield className="accent" size={30} />
            <h2>You stay in control.</h2>
            <p>
              Provider API keys belong only on your backend. The app keeps its
              device access token in memory, not local storage. Conversations
              are not saved by this app unless you export them.
            </p>
            <p>
              When enabled, messages and audio are sent to your selected
              providers. Research sends queries to the search provider and reads
              public pages. Voice tools ask for approval. Those services have
              their own retention policies.
            </p>
            <p>
              Security checks are read-only and limited to authorized hosts.
              This is not a complete vulnerability scanner. Work drafts are
              never sent automatically. No earnings or perfect Sorani
              comprehension are guaranteed.
            </p>
            <p className="muted">
              The two reference files were not provided and were not reviewed.
              This beta source project is not a signed APK.
            </p>
            <button className="primary" onClick={() => setPrivacy(false)}>
              Got it <Check size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function VoicePage({
  settings,
  health,
  notify,
  onSettings,
  onToChat,
}: {
  settings: Settings;
  health: Health | null;
  notify: Toast;
  onSettings: () => void;
  onToChat: (text: string) => void;
}) {
  const [mode, setMode] = useState<"sorani" | "realtime">("sorani"),
    [active, setActive] = useState(false),
    [status, setStatus] = useState("Ready when you are");
  const [lines, setLines] = useState<VoiceLine[]>([]),
    [elapsed, setElapsed] = useState(0),
    [level, setLevel] = useState(0),
    [pending, setPending] = useState<ToolRequest | null>(null);
  const [recording, setRecording] = useState(false),
    [note, setNote] = useState(""),
    [noteBusy, setNoteBusy] = useState(false);
  const controller = useRef<AbortController | null>(null),
    noteController = useRef<AbortController | null>(null),
    noteStop = useRef<(() => void) | null>(null),
    approveResolve = useRef<((value: boolean) => void) | null>(null),
    resume = useRef<(() => Promise<void>) | null>(null);
  const stop = () => {
    approveResolve.current?.(false);
    approveResolve.current = null;
    setPending(null);
    controller.current?.abort();
    controller.current = null;
  };
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        controller.current?.abort();
        noteController.current?.abort();
        approveResolve.current?.(false);
      }
    };
    const background = () => {
      controller.current?.abort();
      noteController.current?.abort();
      approveResolve.current?.(false);
    };
    window.addEventListener("shizz:background", background);
    document.addEventListener("visibilitychange", hide);
    return () => {
      controller.current?.abort();
      noteController.current?.abort();
      approveResolve.current?.(false);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("shizz:background", background);
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    setElapsed(0);
    const tick = setInterval(() => {
      const seconds = Math.floor((Date.now() - start) / 1000);
      setElapsed(seconds);
      if (seconds >= 600) stop();
    }, 1000);
    return () => clearInterval(tick);
  }, [active]);
  const canStart =
    mode === "realtime"
      ? health?.features.realtime
      : health?.features.stt &&
        health?.features.tts &&
        health?.providers.some((p) => p.configured);
  async function start() {
    if (!canStart) {
      onSettings();
      return;
    }
    const control = new AbortController();
    controller.current = control;
    setActive(true);
    setLines([]);
    setStatus("Connecting");
    const append = (line: VoiceLine) => setLines((old) => [...old, line]);
    try {
      if (mode === "realtime") {
        const session = await startRealtime(
          settings,
          control.signal,
          setStatus,
          append,
          (request) =>
            new Promise<boolean>((resolve) => {
              approveResolve.current = resolve;
              setPending(request);
              setStatus("Waiting for your approval");
            }),
        );
        resume.current = session.resume;
        await new Promise<void>((resolve) => {
          if (control.signal.aborted) resolve();
          else
            control.signal.addEventListener("abort", () => resolve(), {
              once: true,
            });
        });
        session.close();
      } else {
        let history: ChatMessage[] = [];
        let empty = 0;
        while (!control.signal.aborted) {
          setStatus("Listening — pause to send your turn");
          const capture = await captureTurn(control.signal, setLevel, true);
          const blob = await capture.done;
          if (control.signal.aborted) break;
          setStatus("Transcribing Sorani");
          const result = await api(settings).transcribe(blob, control.signal);
          if (!result.text.trim()) {
            if (++empty >= 2)
              throw new Error(
                "No speech recognized. Check the mic, noise level and speech-service configuration.",
              );
            continue;
          }
          empty = 0;
          append({ role: "user", content: result.text });
          history.push({ role: "user", content: result.text });
          setStatus("Thinking");
          let full = "";
          await api(settings).chat(
            chatBody({ ...settings, language: "ckb" }, history),
            (event) => {
              if (event.type === "delta") full += event.text || "";
              if (event.type === "error")
                throw new Error(event.message || "Model error");
            },
            control.signal,
          );
          if (!full.trim())
            throw new Error("The model returned no spoken response.");
          append({ role: "assistant", content: full });
          history.push({ role: "assistant", content: full });
          history = history.slice(-24);
          setStatus("Speaking — AI-generated voice");
          const audio = await api(settings).speak(
            full.slice(0, 3500),
            "ckb",
            control.signal,
          );
          await playBlob(audio, control.signal);
        }
      }
    } catch (e) {
      if (!isAbort(e)) notify(errorText(e));
    } finally {
      control.abort();
      setActive(false);
      setStatus("Conversation ended");
      setLevel(0);
      setPending(null);
      approveResolve.current?.(false);
      approveResolve.current = null;
      resume.current = null;
    }
  }
  async function voiceNote() {
    if (recording) {
      noteStop.current?.();
      return;
    }
    if (!health?.features.stt) {
      onSettings();
      return;
    }
    const control = new AbortController();
    noteController.current = control;
    setNote("");
    setNoteBusy(true);
    try {
      const capture = await captureTurn(control.signal, setLevel);
      noteStop.current = capture.stop;
      setRecording(true);
      const blob = await capture.done;
      setRecording(false);
      const result = await api(settings).transcribe(blob, control.signal);
      setNote(result.text);
    } catch (e) {
      if (!isAbort(e)) notify(errorText(e));
    } finally {
      setRecording(false);
      setNoteBusy(false);
      noteStop.current = null;
      noteController.current = null;
    }
  }
  return (
    <div className="tool-page voice-page">
      <Heading
        eyebrow="A MORE NATURAL CONVERSATION"
        title="Speak your mind."
        description="A conversation that starts in your own language."
        icon={AudioLines}
      />
      <div className="segmented">
        <button
          className={mode === "sorani" ? "selected" : ""}
          disabled={active}
          onClick={() => setMode("sorani")}
        >
          Sorani conversation <span>ckb-IQ</span>
        </button>
        <button
          className={mode === "realtime" ? "selected" : ""}
          disabled={active}
          onClick={() => setMode("realtime")}
        >
          Realtime voice <span>EXPERIMENTAL</span>
        </button>
      </div>
      <div className={`voice-stage ${active ? "is-active" : ""}`}>
        <div className="orb-container">
          <div className="orb-ring outer" />
          <div className="orb-ring inner" />
          <div
            className="voice-orb"
            style={{ "--level": level } as CSSProperties}
          >
            <AudioLines size={54} strokeWidth={1.4} />
          </div>
          <span className="orb-star one">✧</span>
          <span className="orb-star two">✦</span>
        </div>
        <div className="voice-state">
          {active && <span className="online-dot" />}
          {status}
        </div>
        <p dir="rtl" className="sorani-invite">
          بە زمانی خۆت قسە بکە.
        </p>
        <div className="voice-controls">
          {active ? (
            <>
              <button className="end-call" onClick={stop}>
                <MicOff size={17} />
                End conversation{" "}
                <span>
                  {Math.floor(elapsed / 60)}:
                  {String(elapsed % 60).padStart(2, "0")}
                </span>
              </button>
              {mode === "realtime" && (
                <button
                  className="secondary"
                  onClick={() =>
                    void resume
                      .current?.()
                      .catch(() =>
                        notify(
                          "Audio playback blocked. Please retry the session.",
                        ),
                      )
                  }
                >
                  Resume audio
                </button>
              )}
            </>
          ) : (
            <button
              className="primary"
              disabled={recording || noteBusy}
              onClick={() => void start()}
            >
              {canStart ? <Mic size={18} /> : <Settings2 size={18} />}{" "}
              {canStart ? "Start conversation" : "Configure voice"}{" "}
              <ArrowUpRight size={16} />
            </button>
          )}
        </div>
        <div className="voice-chips">
          <span>
            <LockKeyhole size={12} />
            Foreground only
          </span>
          <span>
            <Radio size={12} />
            {mode === "sorani"
              ? "Pause-to-send turns"
              : "WebRTC · interruption support"}
          </span>
        </div>
      </div>
      {pending && (
        <div className="approval-card">
          <Shield size={22} />
          <div>
            <b>Allow this research request?</b>
            <p>
              {pending.name === "web_search" ? "Search query" : "Public page"}:{" "}
              {pending.query || pending.url}
            </p>
            <small>This sends the shown data to an external service.</small>
          </div>
          <button
            className="secondary"
            onClick={() => {
              approveResolve.current?.(false);
              setPending(null);
            }}
          >
            Deny
          </button>
          <button
            className="primary"
            onClick={() => {
              approveResolve.current?.(true);
              setPending(null);
            }}
          >
            Allow once
          </button>
        </div>
      )}
      <div className="voice-info-grid">
        <div className="panel">
          <h3>
            <BookOpen size={17} />
            {mode === "sorani"
              ? "Built around Sorani"
              : "Fast, with honest limits"}
          </h3>
          <p>
            {mode === "sorani"
              ? "Google Chirp recognizes ckb-IQ, your chosen model forms the response, and ElevenLabs speaks it. This mode takes turns; it is not simultaneous full-duplex audio."
              : "Uses the OpenAI Realtime API for low-latency speech and interruption. Sorani comprehension and pronunciation are experimental and need native-speaker testing."}
          </p>
          <small>
            Provider fees apply. Ten-minute app-side session limit; set
            provider-side budgets too.
          </small>
        </div>
        <div className="panel">
          <h3>
            <Mic size={17} />
            Just send a voice note
          </h3>
          <p>
            Record up to 45 seconds. Review the Sorani transcript before sending
            it to chat.
          </p>
          <button
            className="text-button"
            disabled={active || (noteBusy && !recording)}
            onClick={() => void voiceNote()}
          >
            {noteBusy && !recording ? (
              <Spinner />
            ) : recording ? (
              <Square size={14} />
            ) : (
              <Mic size={14} />
            )}{" "}
            {recording
              ? "Finish recording"
              : noteBusy
                ? "Transcribing"
                : "Record a note"}
            <ArrowUpRight size={13} />
          </button>
          {note && (
            <>
              <textarea
                aria-label="Review voice transcript"
                dir="auto"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button className="secondary" onClick={() => onToChat(note)}>
                Review in chat <ArrowUpRight size={14} />
              </button>
            </>
          )}
        </div>
      </div>
      <Notice>
        Your microphone is used only after you start. Leaving this page or
        backgrounding the app stops capture. Never record someone without their
        consent.
      </Notice>
      {lines.length > 0 && (
        <div className="panel voice-transcript">
          <h3>
            Session transcript <small>Not saved automatically</small>
          </h3>
          {lines.map((line, i) => (
            <div key={i}>
              <small>{line.role === "user" ? "You" : "shizz ai agent"}</small>
              <RichText text={line.content} />
            </div>
          ))}
          <button
            className="secondary"
            onClick={() =>
              void exportText(
                "shizz-voice-transcript.md",
                lines.map((l) => `## ${l.role}\n${l.content}`).join("\n\n"),
              ).catch((e) => notify(errorText(e)))
            }
          >
            <Download size={14} />
            Export transcript
          </button>
        </div>
      )}
    </div>
  );
}

function ResearchPage({
  settings,
  health,
  notify,
}: {
  settings: Settings;
  health: Health | null;
  notify: Toast;
}) {
  const [mode, setMode] = useState<"search" | "read">("search"),
    [query, setQuery] = useState(""),
    [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [sources, setSources] = useState<Source[]>([]),
    [page, setPage] = useState<{
      title: string;
      url: string;
      text: string;
      truncated: boolean;
    } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setPage(null);
    setSources([]);
    const c = new AbortController();
    controller.current = c;
    try {
      if (mode === "search") {
        const data = await api(settings).json<{ sources: Source[] }>(
          "/api/search",
          { query },
          c.signal,
        );
        setSources(data.sources);
      } else {
        setPage(await api(settings).json("/api/read", { url }, c.signal));
      }
    } catch (e) {
      if (!isAbort(e)) notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tool-page">
      <Heading
        eyebrow="LESS NOISE. BETTER SOURCES."
        title="Follow your curiosity."
        description="Search the public web or read a page without running its scripts."
        icon={Globe2}
      />
      <div className="segmented compact">
        <button
          className={mode === "search" ? "selected" : ""}
          onClick={() => setMode("search")}
        >
          <Search size={15} />
          Search
        </button>
        <button
          className={mode === "read" ? "selected" : ""}
          onClick={() => setMode("read")}
        >
          <BookOpen size={15} />
          Read a URL
        </button>
      </div>
      <form className="research-form" onSubmit={(e) => void run(e)}>
        <div className="search-input">
          {mode === "search" ? <Search size={20} /> : <Globe2 size={20} />}
          <input
            aria-label={mode === "search" ? "Search query" : "Public page URL"}
            type={mode === "search" ? "text" : "url"}
            required
            minLength={mode === "search" ? 2 : 8}
            maxLength={mode === "search" ? 500 : 2048}
            dir="auto"
            value={mode === "search" ? query : url}
            onChange={(e) =>
              mode === "search"
                ? setQuery(e.target.value)
                : setUrl(e.target.value)
            }
            placeholder={
              mode === "search"
                ? "What would you like to find?"
                : "https://example.com/article"
            }
          />
          <button className="primary" disabled={busy}>
            {busy ? <Spinner /> : <ArrowUp size={17} />}
            <span>{mode === "search" ? "Search" : "Read page"}</span>
          </button>
        </div>
      </form>
      {!health?.features.search && (
        <Notice>
          Search is not connected. Add a Brave Search or Tavily key on your
          backend. No fabricated results are shown.
        </Notice>
      )}
      {sources.length > 0 && (
        <>
          <div className="section-label">
            SOURCES TO EXPLORE <span>{sources.length} results</span>
          </div>
          {sources.map((source) => (
            <article className="result-card" key={source.id}>
              <small>
                <span>{source.id}</span>
                {source.url.replace(/^https?:\/\//, "").split("/")[0]}
              </small>
              <button
                onClick={() =>
                  void openLink(source.url).catch((e) => notify(errorText(e)))
                }
              >
                {source.title}
                <ArrowUpRight size={16} />
              </button>
              <p dir="auto">{source.snippet}</p>
              <button
                className="text-button"
                onClick={() => {
                  setUrl(source.url);
                  setMode("read");
                }}
              >
                Read in workspace <BookOpen size={13} />
              </button>
            </article>
          ))}
        </>
      )}
      {page && (
        <article className="panel read-result">
          <h2>{page.title}</h2>
          <button
            className="text-button"
            onClick={() =>
              void openLink(page.url).catch((e) => notify(errorText(e)))
            }
          >
            Open original <ExternalLink size={13} />
          </button>
          <pre dir="auto">{page.text}</pre>
          {page.truncated && (
            <Notice>
              This page was truncated at 28,000 characters. It has not been read
              in full.
            </Notice>
          )}
        </article>
      )}
      {sources.length === 0 && !page && !busy && (
        <div className="empty-state">
          <div className="empty-icon">
            <Globe2 size={34} strokeWidth={1.3} />
          </div>
          <h3>A good answer starts with a good source.</h3>
          <p>
            Search in Sorani or English. Compare the original sources.
            <br />
            For a synthesis with citations, enable Web research in chat.
          </p>
          <div className="capability-row">
            <span>
              <Check size={13} />
              Public pages only
            </span>
            <span>
              <Check size={13} />
              No page scripts
            </span>
            <span>
              <Check size={13} />
              Bounded reads
            </span>
          </div>
        </div>
      )}
      <Notice>
        Queries go to your search provider. Public-page reads block private
        networks and nonstandard ports. JavaScript-only sites, logins and
        downloads are not supported.
      </Notice>
    </div>
  );
}

function SecurityPage({
  settings,
  notify,
}: {
  settings: Settings;
  notify: Toast;
}) {
  const [mode, setMode] = useState<"secrets" | "headers">("secrets"),
    [text, setText] = useState(""),
    [url, setUrl] = useState(""),
    [scope, setScope] = useState(""),
    [authorized, setAuthorized] = useState(false),
    [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{
    findings: {
      line?: number;
      kind?: string;
      severity?: string;
      header?: string;
      state?: string;
      recommendation?: string;
    }[];
    scanner?: string;
    engine?: string;
    note: string;
  } | null>(null);
  async function run(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setReport(null);
    try {
      setReport(
        await api(settings).json(
          mode === "secrets"
            ? "/api/security/secrets"
            : "/api/security/headers",
          mode === "secrets"
            ? { text }
            : { url, scope_host: scope, authorized },
        ),
      );
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tool-page">
      <Heading
        eyebrow="ETHICAL BY DESIGN"
        title="Build a stronger defense."
        description="Small, transparent tools. Clear scope. No exploit automation."
        icon={Shield}
      />
      <div className="segmented compact">
        <button
          className={mode === "secrets" ? "selected" : ""}
          onClick={() => {
            setMode("secrets");
            setReport(null);
          }}
        >
          <FileKey2 size={15} />
          Secret patterns
        </button>
        <button
          className={mode === "headers" ? "selected" : ""}
          onClick={() => {
            setMode("headers");
            setReport(null);
          }}
        >
          <Shield size={15} />
          HTTP headers
        </button>
      </div>
      <div className="panel security-panel">
        <div className="panel-title">
          <div className="starter-icon green">
            {mode === "secrets" ? <FileKey2 size={20} /> : <Shield size={20} />}
          </div>
          <div>
            <h3>
              {mode === "secrets"
                ? "Catch accidental exposure"
                : "Review a public endpoint"}
            </h3>
            <p>
              {mode === "secrets"
                ? "Pattern matching only. Your code is never executed."
                : "One read-only GET, only on a server-allowlisted host."}
            </p>
          </div>
          <span className="outline-tag">READ-ONLY</span>
        </div>
        <form onSubmit={(e) => void run(e)}>
          {mode === "secrets" ? (
            <>
              <Field
                label="Paste text or a code snippet"
                hint="Sent to your backend for scanning, not to an AI provider. Avoid uploading real production secrets."
              >
                <textarea
                  className="code-input"
                  rows={9}
                  value={text}
                  maxLength={80000}
                  required
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    "// Paste a snippet to check for common key patterns.\n// No result is a guarantee that your code is secret-free."
                  }
                />
              </Field>
              <button
                className="text-button example-button"
                type="button"
                onClick={() =>
                  setText(
                    "// Synthetic example — not a real private key\n-----BEGIN PRIVATE KEY-----\nEXAMPLE ONLY",
                  )
                }
              >
                Use a harmless example <Wand2 size={13} />
              </button>
            </>
          ) : (
            <>
              <Field label="Target URL">
                <input
                  type="url"
                  placeholder="https://your-authorized-domain.com/"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  maxLength={2048}
                />
              </Field>
              <Field
                label="Exact authorized hostname"
                hint="An administrator must also add this hostname to SECURITY_ALLOWED_HOSTS on the backend."
              >
                <input
                  placeholder="your-authorized-domain.com"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  required
                  maxLength={253}
                />
              </Field>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                  required
                />
                <span>
                  I own this host or have written permission for this exact
                  check.
                </span>
              </label>
            </>
          )}
          <div className="form-actions">
            <small>
              <LockKeyhole size={12} />
              No shell. No exploitation. No credentials sent.
            </small>
            <button className="primary" disabled={busy}>
              {busy ? <Spinner /> : <Shield size={15} />}Run check
            </button>
          </div>
        </form>
      </div>
      {report && (
        <section className="panel report">
          <div className="section-label">
            CHECK RESULTS <span>{report.scanner || report.engine}</span>
          </div>
          {report.findings.length === 0 ? (
            <div className="clean-result">
              <Check size={24} />
              <div>
                <b>No supported patterns found.</b>
                <p>This is not proof the input contains no secrets.</p>
              </div>
            </div>
          ) : (
            report.findings.map((f, i) => (
              <div className="finding" key={i}>
                <span
                  className={`finding-dot ${f.state === "present" ? "ok" : ""}`}
                />
                <div>
                  <b>{f.kind || f.header}</b>
                  <p>
                    {f.line
                      ? `Line ${f.line} · potential exposure · value redacted`
                      : f.recommendation}
                  </p>
                </div>
                <span
                  className={`severity ${f.state === "present" ? "ok" : ""}`}
                >
                  {f.severity || f.state}
                </span>
              </div>
            ))
          )}
          <Notice>{report.note}</Notice>
          <button
            className="text-button"
            onClick={() =>
              void exportText(
                "shizz-security-report.json",
                JSON.stringify(report, null, 2),
              ).catch((e) => notify(errorText(e)))
            }
          >
            <Download size={14} />
            Export report
          </button>
        </section>
      )}
      <div className="guidance-grid">
        <div className="panel">
          <Code2 size={19} />
          <h3>Learn in a safe lab</h3>
          <p>
            Ask the assistant about secure code, threat modeling or an isolated
            CTF exercise. Never test real assets without permission.
          </p>
        </div>
        <div className="panel">
          <BookOpen size={19} />
          <h3>Report responsibly</h3>
          <p>
            Document evidence, impact and remediation. Check disclosure rules
            and program scope before contacting an owner.
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkPage({ settings, notify }: { settings: Settings; notify: Toast }) {
  const [client, setClient] = useState("New client"),
    [service, setService] = useState("Website security review"),
    [deliverables, setDeliverables] = useState(
      "Review the agreed public website, document observations, and deliver a prioritized remediation report.",
    ),
    [hours, setHours] = useState(8),
    [rate, setRate] = useState(25),
    [currency, setCurrency] = useState("USD"),
    [language, setLanguage] = useState("en"),
    [busy, setBusy] = useState(false),
    [proposal, setProposal] = useState("");
  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api(settings).json<{ markdown: string }>(
        "/api/work/proposal",
        { client, service, deliverables, hours, rate, currency, language },
      );
      setProposal(data.markdown);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tool-page">
      <Heading
        eyebrow="SKILLS INTO SOMETHING USEFUL"
        title="Build your next opportunity."
        description="Draft clear proposals. Price your time. Keep every decision yours."
        icon={BriefcaseBusiness}
      />
      <div className="income-cards">
        {[
          {
            icon: Shield,
            title: "Authorized security reviews",
            detail: "Scope, evidence, remediation.",
          },
          {
            icon: Globe2,
            title: "Sorani localization",
            detail: "Human-reviewed language services.",
          },
          {
            icon: Code2,
            title: "Secure app development",
            detail: "Useful tools for real clients.",
          },
        ].map(({ icon: Icon, title, detail }) => (
          <div className="income-card" key={title}>
            <Icon size={19} />
            <b>{title}</b>
            <small>{detail}</small>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="panel-title">
          <div className="starter-icon orange">
            <BriefcaseBusiness size={20} />
          </div>
          <div>
            <h3>A proposal worth a conversation</h3>
            <p>Transparent estimates, not promises of profit.</p>
          </div>
          <span className="outline-tag">UNSENT DRAFT</span>
        </div>
        <form onSubmit={(e) => void generate(e)}>
          <div className="form-grid">
            <Field label="Client or business">
              <input
                value={client}
                maxLength={120}
                onChange={(e) => setClient(e.target.value)}
                required
              />
            </Field>
            <Field label="Service">
              <input
                value={service}
                maxLength={200}
                onChange={(e) => setService(e.target.value)}
                required
                minLength={2}
              />
            </Field>
          </div>
          <Field label="Agreed deliverables">
            <textarea
              value={deliverables}
              maxLength={2500}
              onChange={(e) => setDeliverables(e.target.value)}
              required
              rows={3}
            />
          </Field>
          <div className="form-grid three">
            <Field label="Estimated hours">
              <input
                type="number"
                min="0.25"
                max="500"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                required
              />
            </Field>
            <Field label="Hourly rate">
              <input
                type="number"
                min="1"
                max="10000"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                required
              />
            </Field>
            <Field label="Currency">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option>USD</option>
                <option>IQD</option>
                <option>EUR</option>
              </select>
            </Field>
          </div>
          <div className="estimate">
            <span>
              Illustrative subtotal{" "}
              <small>Before taxes, fees and external costs</small>
            </span>
            <b>
              {(hours * rate).toLocaleString(undefined, {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}
              <small>{currency}</small>
            </b>
          </div>
          <div className="form-actions">
            <select
              aria-label="Proposal language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en">English draft</option>
              <option value="ckb">ڕەشنووسی کوردی</option>
            </select>
            <button className="primary" disabled={busy}>
              {busy ? <Spinner /> : <Wand2 size={15} />}Create proposal
            </button>
          </div>
        </form>
      </div>
      {proposal && (
        <div className="panel proposal">
          <RichText text={proposal} />
          <div className="form-actions">
            <small>
              Template-generated locally on your backend. Nothing has been sent.
            </small>
            <button
              className="secondary"
              onClick={() =>
                void exportText("shizz-proposal.md", proposal).catch((e) =>
                  notify(errorText(e)),
                )
              }
            >
              <Download size={15} />
              Export draft
            </button>
          </div>
        </div>
      )}
      <Notice>
        This agent does not earn money on its own. It supports legitimate work;
        clients, quality, legal compliance, payments and income remain your
        responsibility.
      </Notice>
    </div>
  );
}

function SettingsPage({
  value,
  health,
  error,
  onSave,
  notify,
}: {
  value: Settings;
  health: Health | null;
  error: string;
  onSave: (s: Settings) => void;
  notify: Toast;
}) {
  const [form, setForm] = useState(value),
    [models, setModels] = useState<{ id: string; name: string }[]>([]),
    [busy, setBusy] = useState(false);
  const set = <K extends keyof Settings>(key: K, next: Settings[K]) =>
    setForm((old) => ({ ...old, [key]: next }));
  async function discover() {
    if (form.provider === "auto") {
      notify("Choose a specific provider before loading its model list.");
      return;
    }
    setBusy(true);
    try {
      const data = await api(form).json<{
        models: { id: string; name: string }[];
        has_more: boolean;
      }>("/api/models?provider=" + form.provider);
      setModels(data.models);
      notify(
        data.models.length
          ? `Loaded ${data.models.length} account-visible models${data.has_more ? " (first page)" : ""}. Availability is not a strength ranking.`
          : "No chat models returned. A manual model ID is supported.",
      );
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="tool-page">
      <Heading
        eyebrow="YOUR AGENT. YOUR CHOICES."
        title="Make it yours."
        description="Connect your backend, choose your models, and set the way you work."
        icon={Settings2}
      />
      <Notice>
        Never put provider API keys in this app. Add them only to the backend’s
        .env file or your hosting secret manager. This form takes a separate
        device access token.
      </Notice>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (form.base) {
              const u = new URL(form.base);
              if (
                u.protocol !== "https:" &&
                !(
                  ["localhost", "127.0.0.1"].includes(u.hostname) &&
                  u.protocol === "http:"
                )
              )
                throw new Error("Use an HTTPS URL.");
              if (u.username || u.password || u.search || u.hash)
                throw new Error(
                  "Remove credentials, query and fragment from the backend URL.",
                );
            }
            onSave(form);
          } catch (e) {
            notify(errorText(e));
          }
        }}
      >
        <section className="panel settings-section">
          <h3>
            <Globe2 size={17} />
            Your secure backend
            <span className={`outline-tag ${health ? "ok" : ""}`}>
              {health ? health.mode.toUpperCase() : "NOT CONNECTED"}
            </span>
          </h3>
          <Field
            label="Backend URL"
            hint="Leave blank only for this same-origin browser preview. The Android app needs your deployed HTTPS server."
          >
            <input
              type="url"
              placeholder="https://your-server.example"
              value={form.base}
              onChange={(e) => set("base", e.target.value)}
            />
          </Field>
          <Field
            label="Device access token"
            hint="Must match APP_ACCESS_TOKEN on your backend. Kept in memory; re-enter after closing the app."
          >
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={form.token}
              onChange={(e) => set("token", e.target.value)}
              placeholder="Not a provider API key"
            />
          </Field>
          {error && <div className="error-box">{error}</div>}
        </section>
        <section className="panel settings-section">
          <h3>
            <Layers size={17} />
            Model routing
          </h3>
          <p>
            Use models your accounts can actually access. There is no automatic
            “most powerful” claim or silent cross-provider fallback.
          </p>
          <div className="form-grid">
            <Field label="Provider">
              <select
                value={form.provider}
                onChange={(e) => {
                  set("provider", e.target.value as Settings["provider"]);
                  setModels([]);
                  set("model", "");
                }}
              >
                <option value="auto">Auto · server-configured route</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic / Claude</option>
                <option value="gemini">Google Gemini</option>
                <option value="compatible">
                  OpenAI-compatible / local model
                </option>
              </select>
            </Field>
            <Field label="Routing profile">
              <select
                value={form.profile}
                onChange={(e) =>
                  set("profile", e.target.value as Settings["profile"])
                }
              >
                <option value="fast">Fast</option>
                <option value="balanced">Balanced</option>
                <option value="deep">Deep</option>
              </select>
            </Field>
          </div>
          <Field
            label="Model ID"
            hint="Blank uses the backend default. Profiles select configured routes; they do not change a model’s reasoning settings."
          >
            <input
              list="available-models"
              value={form.model}
              maxLength={160}
              onChange={(e) => set("model", e.target.value)}
              placeholder="Select or enter an account-available model ID"
            />
            <datalist id="available-models">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </datalist>
          </Field>
          <button
            className="secondary"
            disabled={busy || form.provider === "auto"}
            type="button"
            onClick={() => void discover()}
          >
            {busy ? <Spinner /> : <Layers size={14} />}Load available models
          </button>
          <div className="provider-list">
            {(health?.providers || []).map((p) => (
              <div key={p.id}>
                <span
                  className={`provider-light ${p.configured ? "yes" : ""}`}
                />
                <b>{p.id === "compatible" ? "Compatible endpoint" : p.id}</b>
                <small>
                  {p.configured
                    ? "Key / endpoint configured"
                    : "Not configured"}
                </small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel settings-section">
          <h3>
            <MessageSquare size={17} />
            Language & understanding
          </h3>
          <Field label="Response language">
            <select
              value={form.language}
              onChange={(e) =>
                set("language", e.target.value as Settings["language"])
              }
            >
              <option value="ckb">سۆرانی · Sorani-first</option>
              <option value="match">Match my language</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field
            label="Personal vocabulary"
            hint="Optional spellings and technical terms. Saved on this device and sent with chat; do not include private credentials."
          >
            <textarea
              rows={3}
              maxLength={3000}
              dir="auto"
              placeholder="For example: preferred Sorani terms, your field of study, or how to spell your name."
              value={form.glossary}
              onChange={(e) => set("glossary", e.target.value)}
            />
          </Field>
        </section>
        <section className="panel settings-section">
          <h3>
            <Zap size={17} />
            Service readiness
          </h3>
          <div className="readiness">
            {[
              { key: "search", label: "Live web search" },
              { key: "stt", label: "Google Sorani STT" },
              { key: "tts", label: "ElevenLabs Sorani TTS" },
              { key: "realtime", label: "WebRTC realtime" },
              { key: "header_checks", label: "Scoped header checks" },
            ].map((s) => (
              <div key={s.key}>
                <span>{s.label}</span>
                <small
                  className={
                    health?.features[s.key as keyof Health["features"]]
                      ? "ready"
                      : ""
                  }
                >
                  {health?.features[s.key as keyof Health["features"]]
                    ? "Configured"
                    : "Setup needed"}
                </small>
              </div>
            ))}
          </div>
          <small>
            Configured does not mean connectivity or voice quality has been
            verified. See the included setup guide.
          </small>
        </section>
        <div className="settings-save">
          <small>
            Provider usage may cost money. Set account budgets and alerts.
          </small>
          <button className="primary">
            <Check size={16} />
            Save & connect
          </button>
        </div>
      </form>
      <div className="settings-footer">
        <Logo small />
        <p>
          <b>shizz ai agent</b> · v0.1.0 beta
          <br />
          Python · TypeScript · Go · Rust · Bash
          <br />
          Reference files unavailable; not reviewed. Source project, not a
          signed APK.
        </p>
      </div>
    </div>
  );
}
