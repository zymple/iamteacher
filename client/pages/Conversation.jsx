import { useEffect, useRef, useState } from "react";
import "../css/App.css";
import Navigation from "../components/Navigation";
import BackButton from "../components/conversation/BackButton";
import ControlButton from "../components/conversation/ControlButton";
import DialogueBox from "../components/conversation/DialogueBox";
import StatusDisplay from "../components/conversation/StatusDisplay";
import AlertBox from "../components/conversation/AlertBox";
import { Translate } from "../languages/TranslationsManager";

// Fallback UUID for very old browsers
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Simple in-app browser detector (covers LINE, FB/IG, TikTok, generic webviews)
function detectInAppBrowser(ua = navigator.userAgent || "") {
  const s = ua.toLowerCase();
  return (
    s.includes(" line/") || s.includes("liapp") || // LINE
    s.includes("fbav") || s.includes("fban") || s.includes("fb_iab") || // Facebook
    s.includes("instagram") || // Instagram
    s.includes("tiktok") || // TikTok
    s.includes("wv;") || s.includes("webview") // generic webview
  );
}

// POST helper (ignore errors to avoid breaking UX)
async function postJSON(url, body) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
  } catch (e) {
    console.warn("postJSON failed:", e);
  }
}

export default function Conversation() {
  const [email, setEmail] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [BASE_URL, setBaseUrl] = useState("");

  const [aiReply, setAiReply] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);

  const [webrtcLatency, setWebrtcLatency] = useState(null);
  const [openaiApiLatency, setOpenaiApiLatency] = useState(null);
  const [backendApiLatency, setBackendApiLatency] = useState(null);

  const [callDuration, setCallDuration] = useState(0);
  const callTimer = useRef(null);

  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const micStream = useRef(null); // preflight mic stream

  // UI alert modal
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertText, setAlertText] = useState("");

  // Inactivity watchdog (30s without meaningful AI activity)
  const inactivityTimer = useRef(null);
  const INACTIVITY_MS = 30_000;

  // Pings (one-shot on first visit, then intervals only during call)
  const backendPingIntervalRef = useRef(null);
  const openaiPingIntervalRef = useRef(null);
  const [initialPingDone, setInitialPingDone] = useState(false);

  const openAlert = (text) => {
    setAlertText(text);
    setAlertOpen(true);
  };
  const closeAlert = () => setAlertOpen(false);

  // Config
  useEffect(() => {
    fetch("/config", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setBaseUrl(data.baseUrl || window.location.origin))
      .catch(() => setBaseUrl(window.location.origin));
  }, []);

  // User info
  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setEmail(data.email || "");
        setSessionId(data.sessionId || "");
      })
      .catch((err) => {
        console.error("Failed to load user info", err);
      });
  }, []);

  // Latency helper
  const measureFetchLatency = async (url, setLatencyState) => {
    try {
      const start = Date.now();
      await fetch(url, { method: "GET", mode: "no-cors" });
      const end = Date.now();
      setLatencyState(end - start);
    } catch {
      setLatencyState(null);
    }
  };

  // ---- One-time ping (first load, before any session) ----
  useEffect(() => {
    if (!BASE_URL) return;
    if (isSessionActive) return;
    if (initialPingDone) return;

    measureFetchLatency(`${BASE_URL}`, setBackendApiLatency);
    measureFetchLatency("https://api.openai.com", setOpenaiApiLatency);
    setInitialPingDone(true);
  }, [BASE_URL, isSessionActive, initialPingDone]);

  // ---- Continuous pings during an active session only ----
  useEffect(() => {
    if (!BASE_URL) return;

    // clear old intervals
    clearInterval(backendPingIntervalRef.current);
    clearInterval(openaiPingIntervalRef.current);
    backendPingIntervalRef.current = null;
    openaiPingIntervalRef.current = null;

    if (isSessionActive) {
      backendPingIntervalRef.current = setInterval(() => {
        measureFetchLatency(`${BASE_URL}`, setBackendApiLatency);
      }, 5000);

      openaiPingIntervalRef.current = setInterval(() => {
        measureFetchLatency("https://api.openai.com", setOpenaiApiLatency);
      }, 5000);
    }

    return () => {
      clearInterval(backendPingIntervalRef.current);
      clearInterval(openaiPingIntervalRef.current);
      backendPingIntervalRef.current = null;
      openaiPingIntervalRef.current = null;
    };
  }, [isSessionActive, BASE_URL]);

  // Conversation log helper
  const logConv = (role, text) => postJSON("/conversation/log", { role, text });

  // ----- Microphone preflight check -----
  const ensureMicrophoneReady = async () => {
    if (detectInAppBrowser()) {
      openAlert(
        <Translate>error.in_app_browser</Translate>
      );
      return null;
    }

    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: "microphone" });
        if (status.state === "denied") {
          openAlert(
            <Translate>error.microphone_permission_blocked</Translate>
          );
          return null;
        }
      }
    } catch {
      // ignore
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      const live = tracks.some((t) => t.readyState === "live");
      if (!live) {
        stream.getTracks().forEach((t) => t.stop());
        openAlert(
          <Translate>error.microphone_aquired_but_no_audio</Translate>
        );
        return null;
      }
      micStream.current = stream;
      return stream;
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError") {
        openAlert(<Translate>error.microphone_permission_denied</Translate>);
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        openAlert(<Translate>error.microphone_not_found</Translate>);
      } else {
        openAlert(`${<Translate>error.microphone_failed_to_access_generic</Translate>}${String(err?.message || err)}`);
      }
      return null;
    }
  };

  // ----- Inactivity watchdog -----
  const resetInactivityTimer = () => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      logConv("INFO", "Session terminated due to 30s inactivity from AI.");
      openAlert("No response from AI for 30 seconds. The session was ended.");
      stopSession("inactive-30s");
    }, INACTIVITY_MS);
  };

  async function startSession() {
    try {
      const preflight = await ensureMicrophoneReady();
      if (!preflight) return;

      await postJSON("/log-voice-session", { action: "start" });

      const tokenResponse = await fetch("/token", { credentials: "include" });
      if (!tokenResponse.ok) throw new Error("Failed to fetch /token");
      const data = await tokenResponse.json();
      const EPHEMERAL_KEY = data?.client_secret?.value;
      if (!EPHEMERAL_KEY) throw new Error("Missing ephemeral key");

      const pc = new RTCPeerConnection();
      peerConnection.current = pc;

      audioElement.current = document.createElement("audio");
      audioElement.current.autoplay = true;
      pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

      pc.addTrack(micStream.current.getTracks()[0]);

      const dc = pc.createDataChannel("oai-events");
      setDataChannel(dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const systemPrompt =
        "You are a friendly, encouraging English tutor for young children (EFL learners). Speak naturally and clearly, using short sentences. Pause after each sentence so the student can respond. Focus today's lesson on talking about a movie the student watched yesterday. Start by greeting them in English and inviting them to learn.";

      const sdpResponse = await fetch(
        `${baseUrl}?model=${encodeURIComponent(model)}&input=${encodeURIComponent(systemPrompt)}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp",
          },
        }
      );

      const answer = { type: "answer", sdp: await sdpResponse.text() };
      await pc.setRemoteDescription(answer);

      // Start inactivity watchdog waiting for first AI response
      resetInactivityTimer();
    } catch (error) {
      console.error("Error starting session:", error);
      logConv("INFO", `Failed to start session: ${String(error?.message || error)}`);
    }
  }

  function stopSession(reason = "") {
    try {
      clearTimeout(inactivityTimer.current);

      if (dataChannel) dataChannel.close();

      if (peerConnection.current) {
        peerConnection.current.getSenders().forEach((sender) => {
          if (sender.track) sender.track.stop();
        });
        peerConnection.current.close();
      }

      if (micStream.current) {
        micStream.current.getTracks().forEach((t) => t.stop());
        micStream.current = null;
      }

      // stop all pings after session ends
      clearInterval(backendPingIntervalRef.current);
      clearInterval(openaiPingIntervalRef.current);
      backendPingIntervalRef.current = null;
      openaiPingIntervalRef.current = null;

      postJSON("/log-voice-session", {
        action: "stop",
        duration: callDuration,
        reason,
      });
    } finally {
      setIsSessionActive(false);
      setIsRecording(false);
      setDataChannel(null);
      peerConnection.current = null;
      clearInterval(callTimer.current);
      setCallDuration(0);
      setWebrtcLatency(null);
    }
  }

  // Data channel events
  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (!event.timestamp) event.timestamp = new Date().toLocaleTimeString();

        // Reset inactivity only on meaningful AI activity
        if (
          event.type === "response.created" ||
          event.type === "response.output_text.delta" ||
          event.type === "response.done"
        ) {
          resetInactivityTimer();
        }

        // WebRTC ping/pong latency
        if (event.type === "pong" && event.pingTimestamp) {
          const ping = Date.now() - event.pingTimestamp;
          setWebrtcLatency(ping);
        }

        // When AI completes a response with audio + transcript
        if (event.type === "response.done" && event.response?.output?.length > 0) {
          setAiReply("");
          for (const item of event.response.output) {
            const audioContent = item.content?.find(
              (c) => c.type === "audio" && c.transcript
            );
            if (audioContent?.transcript) {
              const line = audioContent.transcript;
              setAiReply((prev) => (prev ? `${prev} ${line}` : line));
              logConv("SYSTEM", line);
            }
          }
        }

        setEvents((prev) => [event, ...prev]);
      } catch (err) {
        console.warn("Failed to parse dataChannel message", err);
      }
    };

    const handleOpen = () => {
      setIsSessionActive(true);
      setAiReply("");
      setEvents([]);
      setIsRecording(true);

      callTimer.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      logConv("INFO", "WebRTC data channel opened");
      resetInactivityTimer();
    };

    const handleClose = () => {
      logConv("INFO", "WebRTC data channel closed");
      stopSession();
      // Optional auto-reconnect:
      // setTimeout(() => startSession(), 3000);
    };

    const handleError = (e) => {
      logConv("INFO", `WebRTC data channel error: ${String(e?.message || e)}`);
      stopSession();
    };

    dataChannel.addEventListener("message", handleMessage);
    dataChannel.addEventListener("open", handleOpen);
    dataChannel.addEventListener("close", handleClose);
    dataChannel.addEventListener("error", handleError);

    // WebRTC latency ping
    const pingInterval = setInterval(() => {
      if (dataChannel.readyState === "open") {
        dataChannel.send(
          JSON.stringify({ type: "ping", pingTimestamp: Date.now(), event_id: uuid() })
        );
      }
    }, 5000);

    return () => {
      dataChannel.removeEventListener("message", handleMessage);
      dataChannel.removeEventListener("open", handleOpen);
      dataChannel.removeEventListener("close", handleClose);
      dataChannel.removeEventListener("error", handleError);
      clearInterval(pingInterval);
      clearInterval(callTimer.current);
      clearTimeout(inactivityTimer.current);
    };
  }, [dataChannel]);

  const formatDuration = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="app-container">
      <BackButton />
      <div className="page-title">
        <strong>iAmTeacher - Yesterday&apos;s movie</strong>
      </div>

      <div className="scene-wrapper">
        <img src="/assets/tutor_f.png" alt="Tutor Avatar" className="avatar" />
        <DialogueBox aiReply={aiReply} />
        <ControlButton
          isRecording={isRecording}
          isSessionActive={isSessionActive}
          startSession={startSession}
          stopSession={stopSession}
        />
        <StatusDisplay
          callDuration={callDuration}
          webrtcLatency={webrtcLatency}
          openaiApiLatency={openaiApiLatency}
          backendApiLatency={backendApiLatency}
          isSessionActive={isSessionActive}
          formatDuration={formatDuration}
        />
      </div>

      <Navigation />
      <AlertBox open={alertOpen} text={alertText} onClose={closeAlert} detectInAppBrowser={detectInAppBrowser}/>
    </div>
  );
}
