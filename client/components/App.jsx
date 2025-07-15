import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import '../App.css';

export default function App() {
  const [username, setUsername] = useState('');
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  // Fetch logged-in username
  useEffect(() => {
    fetch("/api/me")
      .then(res => {
        if (res.status === 401) {
          window.location.href = "/login";
        } else {
          return res.json();
        }
      })
      .then(data => {
        setUsername(data?.username);
      })
      .catch(err => {
        console.error("Failed to load user info", err);
      });
  }, []);

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

      // Remote audio
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
    setDataChannel(null);
    peerConnection.current = null;
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

  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };
    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  useEffect(() => {
    if (dataChannel) {
      dataChannel.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        if (!event.timestamp) {
          event.timestamp = new Date().toLocaleTimeString();
        }

        // AI reply from response.done (transcript from audio reply)
        if (
          event.type === "response.done" &&
          event.response?.output?.length > 0
        ) {
          for (const item of event.response.output) {
            // clear previous AI reply
            setAiReply('');

            const audioContent = item.content?.find(
              (c) => c.type === "audio" && c.transcript
            );
            if (audioContent) {
              setAiReply((prev) => `${prev} ${audioContent.transcript}`);
            }
          }
        }

        setEvents((prev) => [event, ...prev]);
      });

      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setTranscript('');
        setAiReply('');
        setEvents([]);
      });
    }
  }, [dataChannel]);

  return (
    <div className="app-container">
      <div className="page-title">
        <strong>AI English Tutor - Yesterday's movie</strong>
      </div>

    <div style={{ position: "absolute", top: "10px", right: "10px", textAlign: "right" }}>
  {username && (
    <>
      <div>Welcome, <strong>{username}</strong> <button onClick={logout} className="control-button logout">Logout</button></div>
    </>
  )}
</div>
      <div className="scene-wrapper">
        <img
          src="/assets/tutor_f.png"
          alt="Tutor Avatar"
          className="avatar"
        />

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
                setIsRecording(false);
              } else {
                await startSession();
                setIsRecording(true);
              }
            }}
            className={`control-button ${isRecording ? "recording" : "idle"}`}
          >
            {isRecording ? "วางสาย" : "เริ่มการโทร"}
          </button>
        </div>
      </div>
    </div>
  );
}
