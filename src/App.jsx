// src/App.jsx
import React, { useState, useRef } from 'react';
import './App.css';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

function App() {
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const systemContent = `You are a friendly, encouraging English tutor for young children (EFL learners).
Speak naturally and clearly, using short sentences. Pause after each sentence so the student can respond.
Focus today's lesson on talking about a movie the student watched yesterday.
Start by greeting them in English and inviting them to learn.
Help teach vocabulary like: hero, adventure, village, monster, magic.
Give fun, positive feedback. Avoid long explanations. Speak as if it's a natural conversation.
Only reply with one or two short English sentences at a time.`; // (keep your full system prompt here)

  const connectRealtime = async () => {
    if (wsRef.current) return;

    const ws = new WebSocket(`wss://ai-tutor-proxy.techtransthai.org`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'start',
        model: 'gpt-4o',
        config: {
          audio: {
            input: { encoding: 'webm-opus' },
            output: { voice: 'nova' }
          }
        },
        messages: [{ role: 'system', content: systemContent }]
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'transcript') {
        setTranscript(msg.text || '');
      } else if (msg.type === 'content') {
        setAiReply(prev => prev + (msg.delta || ''));
      } else if (msg.type === 'audio') {
        const audioBlob = new Blob([msg.audio], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch(() => {
          console.warn("Mobile autoplay may be blocked until user gesture");
        });
      }
    };

    ws.onerror = (err) => console.error("WebSocket error", err);
    ws.onclose = (e) => {
      console.warn("WebSocket closed", e.code, e.reason);
      wsRef.current = null;
    };
  };

  const startRecording = async () => {
    await connectRealtime();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 64000
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(e.data);
      }
    };

    recorder.start(250); // Send every 250ms
    mediaRecorderRef.current = recorder;
    setTranscript('');
    setAiReply('');
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
  };

  return (
    <div className="app-container">

      <div className="page-title">
        <strong>AI English Tutor - Yesterday's movie</strong>
      </div>

      <div className="scene-wrapper">
        <img src="/tutor_f.png" alt="Tutor Avatar" className="avatar" />

        <div className="dialogue-box">
          <div className="dialogue-text">
            <strong>คุณ:</strong> {transcript || <em>ลองพูดอะไรบางอย่าง</em>}
          </div>
          <div className="dialogue-text">
            <strong>ติวเตอร์:</strong> {aiReply || <em>กำลังรอคำถามของคุณ</em>}
          </div>
        </div>

        <div className="button-container">
          <button
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            className={`control-button ${isRecording ? 'recording' : 'idle'}`}
          >
            {isRecording ? 'กำลังพูด...' : 'กดค้างเพื่อพูด'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
