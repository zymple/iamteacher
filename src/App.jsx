// ai-tutor-poc/src/App.jsx
import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

function App() {
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const audioContextRef = useRef(null);
  const systemContent = `You are an English tutor who is kind, fun to be around, and skilled at teaching English through engaging stories and conversations. You are assigned to talk with a primary school EFL student to help them learn English.

The conversation will start with the student greeting you in Thai, and you will invite the student to learn English. Explain that today's lesson will be based on a conversation about the movie they watched yesterday.

Focus on the following learning objectives:

    - Introduce and practice new vocabulary related to the movie.
    - Encourage the student to describe the movie plot, characters, and lessons learned.
    - Practice forming complete sentences and expressing opinions.

Provide context for the movie by briefly describing it (e.g., "Yesterday, you watched an animated movie about a brave young hero who goes on an adventure to save their village.").

Use an encouraging and patient tone. Ask open-ended questions to prompt the student to use new vocabulary and phrases. For example:

    - Can you tell me about your favorite character in the movie?
    - What was the most exciting part of the movie for you?
    - How do you think the hero felt when they achieved their goal?

Include interactive elements such as:

    - Asking the student to describe a scene from the movie using new vocabulary.
    - Encouraging the student to act out a short dialogue from the movie.

The whole conversation should last about 5 minutes, keeping the student engaged and motivated to practice their English skills.`;

  useEffect(() => {
    const initRecording = async () => {
      audioStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current);

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const inputAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = []; // Clear for next recording
        const formData = new FormData();
        formData.append('file', inputAudioBlob, 'input.webm');
        formData.append('model', 'whisper-1');

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`
          },
          body: formData
        });
        const { text } = await whisperRes.json();
        setTranscript(text);

        const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemContent },
              { role: 'user', content: text }
            ]
          })
        });
        const chatData = await chatRes.json();
        if (!chatData.choices || !chatData.choices[0]) {
          console.error('Chat API response error:', chatData);
          setAiReply('Sorry, something went wrong with the AI response.');
          return;
        }
        const reply = chatData.choices[0].message.content;
        setAiReply(reply);

        const speechRes = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'tts-1-hd',
            voice: 'nova',
            input: reply
          })
        });
        const outputAudioBlob = await speechRes.blob();
        const audioUrl = URL.createObjectURL(outputAudioBlob);
        const audio = new Audio(audioUrl);
        audio.play();

        audio.onended = () => {
          if (mediaRecorderRef.current && audioStreamRef.current) {
            audioChunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
            monitorSilence();
          }
        };
      };
    };

    initRecording();
  }, []);

  const monitorSilence = () => {
  if (!audioStreamRef.current) return;

  if (audioContextRef.current) {
    audioContextRef.current.close();
  }
  audioContextRef.current = new AudioContext();

  // Resume AudioContext to avoid browser autoplay policy issues
  audioContextRef.current.resume().then(() => {
    const source = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    dataArrayRef.current = dataArray;
    source.connect(analyser);

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');

    const SILENCE_THRESHOLD = 0.02;  // Adjust as needed (0 to 1 scale)
    const SILENCE_TIMEOUT = 1500; // ms

    let silenceStart = null;

    const checkSilenceAndDraw = () => {
      analyser.getByteTimeDomainData(dataArray);

      // Draw waveform (same as before)
      canvasCtx.fillStyle = '#000';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = '#00ff00';
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;
        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();

      // RMS calculation
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / bufferLength);

      if (rms < SILENCE_THRESHOLD) {
        // Silence detected
        if (!silenceStart) silenceStart = Date.now();
        else if (Date.now() - silenceStart > SILENCE_TIMEOUT) {
          if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            audioContextRef.current.close();
          }
          silenceStart = null; // reset after stopping
          return; // stop animation loop on silence stop
        }
      } else {
        // Sound detected
        silenceStart = null;
      }

      requestAnimationFrame(checkSilenceAndDraw);
    };


  });
};

  const toggleRecording = () => {
    if (!isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      monitorSilence();
    } else {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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

        {isRecording && (
          <canvas
            ref={canvasRef}
            width={300}
            height={60}
            className="waveform-canvas"
          />
        )}

        <div className="button-container">
          <button
            onClick={toggleRecording}
            className={`control-button ${isRecording ? 'recording' : 'idle'}`}
          >
            {isRecording ? 'ฉันพูดเสร็จแล้ว' : 'พูด'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
