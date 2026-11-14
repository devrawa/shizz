import { api } from "./api";
import type { Settings } from "./api";

export type ToolRequest = {
  name: "web_search" | "read_page";
  query?: string;
  url?: string;
};
export type VoiceLine = { role: "user" | "assistant"; content: string };
export function abortError() {
  return new DOMException("Conversation ended", "AbortError");
}

export async function captureTurn(
  signal: AbortSignal,
  onLevel: (level: number) => void,
  automatic = false,
) {
  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  )
    throw new Error(
      "Microphone recording needs HTTPS, microphone permission and a current Android WebView.",
    );
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  if (signal.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    throw abortError();
  }
  const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((v) =>
    MediaRecorder.isTypeSupported(v),
  );
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    throw error;
  }
  let stop = () => {};
  const done = new Promise<Blob>((resolve, reject) => {
    const chunks: BlobPart[] = [];
    let bytes = 0,
      frame = 0,
      ended = false;
    let context: AudioContext;
    try {
      context = new AudioContext();
    } catch (error) {
      stream.getTracks().forEach((t) => t.stop());
      reject(error);
      return;
    }
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    void context.resume().catch(() => {});
    const samples = new Float32Array(analyser.fftSize);
    const start = performance.now();
    let lastSpeech = start,
      heard = false;
    const cleanup = () => {
      cancelAnimationFrame(frame);
      clearTimeout(limit);
      stream.getTracks().forEach((t) => t.stop());
      void context.close().catch(() => {});
      signal.removeEventListener("abort", abort);
      onLevel(0);
    };
    const finish = () => {
      if (recorder.state !== "inactive") recorder.stop();
    };
    const abort = () => {
      ended = true;
      finish();
      cleanup();
      reject(abortError());
    };
    stop = finish;
    const limit = setTimeout(finish, 45000);
    signal.addEventListener("abort", abort, { once: true });
    recorder.ondataavailable = (e) => {
      if (e.data.size) {
        bytes += e.data.size;
        chunks.push(e.data);
        if (bytes > 9_000_000) finish();
      }
    };
    recorder.onerror = () => {
      if (!ended) {
        ended = true;
        cleanup();
        reject(new Error("Recording failed. Check microphone permissions."));
      }
    };
    recorder.onstop = () => {
      if (!ended) {
        ended = true;
        cleanup();
        resolve(new Blob(chunks, { type: recorder.mimeType }));
      }
    };
    function meter() {
      if (ended) return;
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((n, v) => n + v * v, 0) / samples.length,
      );
      onLevel(Math.min(1, rms * 8));
      const now = performance.now();
      if (rms > 0.025) {
        heard = true;
        lastSpeech = now;
      }
      if (
        automatic &&
        ((heard && now - lastSpeech > 1250 && now - start > 700) ||
          (!heard && now - start > 12000))
      ) {
        finish();
        return;
      }
      frame = requestAnimationFrame(meter);
    }
    try {
      recorder.start(250);
      meter();
    } catch (error) {
      ended = true;
      cleanup();
      reject(error);
    }
  });
  return { stop: () => stop(), done };
}

export async function playBlob(blob: Blob, signal: AbortSignal) {
  if (signal.aborted) throw abortError();
  const url = URL.createObjectURL(blob),
    audio = new Audio(url);
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        audio.pause();
        reject(abortError());
      };
      signal.addEventListener("abort", abort, { once: true });
      const clean = () => signal.removeEventListener("abort", abort);
      audio.onended = () => {
        clean();
        resolve();
      };
      audio.onerror = () => {
        clean();
        reject(new Error("Audio playback failed."));
      };
      audio.play().catch(() => {
        clean();
        reject(
          new Error(
            "Audio was blocked. Tap the conversation control and retry.",
          ),
        );
      });
    });
  } finally {
    audio.pause();
    audio.src = "";
    URL.revokeObjectURL(url);
  }
}

export async function startRealtime(
  settings: Settings,
  signal: AbortSignal,
  status: (text: string) => void,
  line: (item: VoiceLine) => void,
  approve: (request: ToolRequest) => Promise<boolean>,
) {
  if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia)
    throw new Error(
      "WebRTC needs HTTPS, an updated WebView and microphone permission.",
    );
  const pc = new RTCPeerConnection();
  let stream: MediaStream | undefined;
  const audio = document.createElement("audio");
  audio.autoplay = true;
  let dc: RTCDataChannel | undefined,
    toolCount = 0,
    closed = false;
  audio.style.display = "none";
  document.body.appendChild(audio);
  const close = () => {
    if (closed) return;
    closed = true;
    stream?.getTracks().forEach((t) => t.stop());
    dc?.close();
    pc.close();
    audio.pause();
    audio.srcObject = null;
    audio.remove();
    signal.removeEventListener("abort", close);
  };
  signal.addEventListener("abort", close, { once: true });
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    if (signal.aborted || closed) {
      // Permission may resolve after cleanup already ran; stop these newly acquired tracks too.
      stream.getTracks().forEach((t) => t.stop());
      close();
      throw abortError();
    }
    stream.getTracks().forEach((track) => pc.addTrack(track, stream!));
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0];
      void audio.play().catch(() => status("Audio blocked — tap Resume audio"));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        status("Connection failed — end and retry");
        close();
      }
    };
    dc = pc.createDataChannel("oai-events");
    const send = (event: unknown) => {
      if (dc?.readyState === "open") dc.send(JSON.stringify(event));
    };
    dc.onopen = () => {
      status("Listening");
      send({
        type: "response.create",
        response: {
          instructions:
            "Greet the user briefly in Sorani Kurdish. Say your name is shizz ai agent.",
        },
      });
    };
    dc.onmessage = async (event) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      const type = String(data.type || "");
      if (type === "input_audio_buffer.speech_started") status("Listening");
      if (
        type === "response.output_audio.delta" ||
        type === "response.audio.delta"
      )
        status("Speaking");
      if (type === "response.done") status("Listening");
      if (
        type === "conversation.item.input_audio_transcription.completed" &&
        typeof data.transcript === "string"
      )
        line({ role: "user", content: data.transcript });
      if (
        [
          "response.output_audio_transcript.done",
          "response.audio_transcript.done",
        ].includes(type) &&
        typeof data.transcript === "string"
      )
        line({ role: "assistant", content: data.transcript });
      if (type === "error")
        status(
          "Voice provider error — end and check your server configuration",
        );
      if (type === "response.function_call_arguments.done") {
        let output: unknown = { error: "Tool not allowed" };
        try {
          if (!["web_search", "read_page"].includes(String(data.name)))
            throw new Error("Unsupported tool");
          const args = JSON.parse(String(data.arguments || "{}"));
          const request: ToolRequest = {
            name: data.name as ToolRequest["name"],
            query: typeof args.query === "string" ? args.query : undefined,
            url: typeof args.url === "string" ? args.url : undefined,
          };
          if (++toolCount > 6)
            output = { error: "Six-tool session limit reached" };
          else if (await approve(request)) {
            status("Researching");
            output = await api(settings).json(
              "/api/voice/tool",
              request,
              signal,
            );
          } else
            output = {
              error:
                "The user did not approve this request. Do not retry without a new user request.",
            };
        } catch {
          output = {
            error:
              "The approved tool request failed. Do not invent its result.",
          };
        }
        send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: data.call_id,
            output: JSON.stringify(output),
          },
        });
        send({ type: "response.create" });
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const timer = setTimeout(resolve, 2500);
      const listener = () => {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timer);
          pc.removeEventListener("icegatheringstatechange", listener);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", listener);
    });
    const answer = await api(settings).realtime(
      pc.localDescription?.sdp || offer.sdp || "",
      signal,
    );
    if (signal.aborted) throw abortError();
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    return { close, resume: () => audio.play() };
  } catch (e) {
    close();
    throw e;
  }
}
