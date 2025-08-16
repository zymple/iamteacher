import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import "../App.css";

export default function Conversation() {
  const [email, setemail] = useState("");
  const [aiReply, setAiReply] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [webrtcLatency, setWebrtcLatency] = useState(null); // Renamed for clarity
  const [openaiApiLatency, setOpenaiApiLatency] = useState(null);
  const [backendApiLatency, setBackendApiLatency] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const callTimer = useRef(null);

  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  // Define BASE_URL, assuming it's available in your .env or similar
  const BASE_URL = "https://iamteacher-fossasia-demo.techtransthai.org";

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
        } else {
          return res.json();
        }
      })
      .then((data) => {
        setemail(data?.email);
      })
      .catch((err) => {
        console.error("Failed to load user info", err);
      });
  }, []);

  // Function to measure latency using fetch
  const measureFetchLatency = async (url, setLatencyState) => {
    try {
      const start = Date.now();
      await fetch(url, { method: 'GET', mode: 'no-cors' }); // Using HEAD and no-cors for efficiency
      const end = Date.now();
      setLatencyState(end - start);
    } catch (error) {
      console.error(`Failed to measure latency for ${url}:`, error);
      setLatencyState(null); // Indicate failure
    }
  };

  useEffect(() => {
    // Ping backend API every 5 seconds
    const backendPingInterval = setInterval(() => {
      measureFetchLatency(`${BASE_URL}`, setBackendApiLatency);
    }, 5000);

    // Ping OpenAI API every 5 seconds (using a small, public endpoint)
    const openaiPingInterval = setInterval(() => {
      measureFetchLatency("https://api.openai.com", setOpenaiApiLatency);
    }, 5000);

    return () => {
      clearInterval(backendPingInterval);
      clearInterval(openaiPingInterval);
    };
  }, [BASE_URL]);


  async function logout() {
    await fetch("/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function startSession() {
    try {
      const tokenResponse = await fetch("/token");
      const data = await tokenResponse.json();
      const EPHEMERAL_KEY = data.client_secret.value;

      const pc = new RTCPeerConnection();

      audioElement.current = document.createElement("audio");
      audioElement.current.autoplay = true;
      pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc.addTrack(ms.getTracks()[0]);

      const dc = pc.createDataChannel("oai-events");
      setDataChannel(dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const systemPrompt = encodeURIComponent(
        "You are a friendly, encouraging English tutor for young children (EFL learners). Speak naturally and clearly, using short sentences. Pause after each sentence so the student can respond. Focus today's lesson on talking about a movie the student watched yesterday. Start by greeting them in English and inviting them to learn."
      );

      const sdpResponse = await fetch(`${baseUrl}?model=${model}&input=${systemPrompt}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp",
        },
      });

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);

      peerConnection.current = pc;
    } catch (error) {
      console.error("Error starting session:", error);
    }
  }

  function stopSession() {
    if (dataChannel) dataChannel.close();

    if (peerConnection.current) {
      peerConnection.current.getSenders().forEach((sender) => {
        if (sender.track) sender.track.stop();
      });
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setIsRecording(false);
    setDataChannel(null);
    peerConnection.current = null;
    clearInterval(callTimer.current);
    setCallDuration(0);
    setWebrtcLatency(null); // Reset WebRTC latency
  }

  function sendClientEvent(message) {
    if (dataChannel) {
      const timestamp = new Date().toLocaleTimeString();
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannel.send(JSON.stringify(message));
      if (!message.timestamp) {
        message.timestamp = timestamp;
      }
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error("No data channel available", message);
    }
  }

  useEffect(() => {
    if (!dataChannel) return;

    const handleMessage = (e) => {
      const event = JSON.parse(e.data);
      if (!event.timestamp) event.timestamp = new Date().toLocaleTimeString();

      if (event.type === "pong" && event.pingTimestamp) {
        const ping = Date.now() - event.pingTimestamp;
        setWebrtcLatency(ping); // Use the new state variable
      }

      if (
        event.type === "response.done" &&
        event.response?.output?.length > 0
      ) {
        setAiReply("");
        for (const item of event.response.output) {
          const audioContent = item.content?.find(
            (c) => c.type === "audio" && c.transcript
          );
          if (audioContent) {
            setAiReply((prev) => `${prev} ${audioContent.transcript}`);
          }
        }
      }

      setEvents((prev) => [event, ...prev]);
    };

    const handleOpen = () => {
      setIsSessionActive(true);
      setAiReply("");
      setEvents([]);
      setIsRecording(true);

      callTimer.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    };

    const handleClose = () => {
      console.warn("Data channel closed, trying to reconnect...");
      stopSession();
      setTimeout(() => startSession(), 3000);
    };

    const handleError = (e) => {
      console.error("Data channel error:", e);
      stopSession();
      setTimeout(() => startSession(), 3000);
    };

    dataChannel.addEventListener("message", handleMessage);
    dataChannel.addEventListener("open", handleOpen);
    dataChannel.addEventListener("close", handleClose);
    dataChannel.addEventListener("error", handleError);

    const pingInterval = setInterval(() => {
      if (dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify({ type: "ping", pingTimestamp: Date.now() }));
      }
    }, 5000);

    return () => {
      dataChannel.removeEventListener("message", handleMessage);
      dataChannel.removeEventListener("open", handleOpen);
      dataChannel.removeEventListener("close", handleClose);
      dataChannel.removeEventListener("error", handleError);
      clearInterval(pingInterval);
      clearInterval(callTimer.current);
    };
  }, [dataChannel]);

  const formatDuration = (seconds) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="app-container">
      <div className="page-title">
        <strong>iAmTeacher - Yesterday's movie</strong>
      </div>

      <div style={{ position: "absolute", top: "10px", right: "10px", textAlign: "right" }}>
        {email && (
          <>
            <div>
              Welcome, <strong>{email}</strong>{" "}
              <button onClick={logout} className="control-button logout">Logout</button>
            </div>
          </>
        )}
      </div>

      <div className="scene-wrapper">
        <img src="/assets/tutor_f.png" alt="Tutor Avatar" className="avatar" />

        <div className="dialogue-box">
          <div className="dialogue-text">
            <strong>ติวเตอร์:</strong> {aiReply || <em>กำลังรอคำถามของคุณ</em>}
          </div>
        </div>

        <div className="button-container">
          <button
            onClick={async () => {
              if (isSessionActive) {
                stopSession();
              } else {
                await startSession();
              }
            }}
            className={`control-button ${isRecording ? "recording" : "idle"}`}
          >
            {isRecording ? "วางสาย" : "เริ่มการโทร"}
          </button>
        </div>

        {/* Status Display */}
        <div style={{ marginTop: 10, textAlign: "center" }}>
          {isSessionActive && (
            <>
              <div>📞 Duration: {formatDuration(callDuration)}</div>
              {webrtcLatency !== null && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    color:
                      webrtcLatency < 150
                        ? "green"
                        : webrtcLatency < 300
                        ? "orange"
                        : "red",
                    fontWeight: 500,
                  }}
                >
                  ⏱️ WebRTC Latency: {webrtcLatency} ms
                </div>
              )}
            </>
          )}
          {/* Display general API latencies */}
          {openaiApiLatency !== null && (
            <div
              style={{
                marginTop: "0.5rem",
                color:
                  openaiApiLatency < 300
                    ? "green"
                    : openaiApiLatency < 600
                    ? "orange"
                    : "red",
                fontWeight: 500,
              }}
            >
              🌐 OpenAI: {openaiApiLatency} ms
            </div>
          )}
          {backendApiLatency !== null && (
            <div
              style={{
                marginTop: "0.5rem",
                color:
                  backendApiLatency < 150
                    ? "green"
                    : backendApiLatency < 300
                    ? "orange"
                    : "red",
                fontWeight: 500,
              }}
            >
              🏠 TechTransThai: {backendApiLatency} ms
            </div>
          )}
        </div>
      </div>
    </div>
  );
}