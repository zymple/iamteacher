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
  const systemContent = `คุณเป็นครูสอนภาษาอังกฤษที่ใจดี เป็นกันเอง และสอนภาษาอังกฤษผ่านการใช้เรื่องราวหรือบทสนทนาได้เป็นอย่างดีอและสนุกสนาน

คุณได้รับมอบหมายให้พูดคุยกับนักเรียนระดับประถมที่เรียนภาษาอังกฤษเป็นภาษาต่างประเทศ (EFL) เพื่อช่วยให้นักเรียนเรียนรู้ภาษาอังกฤษอย่างเป็นธรรมชาติ

นักเรียนจะเริ่มต้นบทสนทนาด้วยการทักทายเป็นภาษาไทย จากนั้นคุณจะเชิญชวนนักเรียนให้มาเรียนภาษาอังกฤษด้วยกัน พร้อมอธิบายว่า บทเรียนวันนี้จะเกี่ยวกับหนังที่นักเรียนดูเมื่อวานนี้

**พูดทีละประโยคสั้น ๆ และหยุดพูดหลังจากแต่ละประโยคเพื่อรอให้นักเรียนตอบก่อน**  
การสนทนานี้จะเหมือนการพูดคุยแบบปากเปล่า จึงควรพูดด้วยน้ำเสียงที่เป็นธรรมชาติ ให้กำลังใจ และเป็นกันเอง

เป้าหมายของบทเรียนวันนี้
- แนะนำและฝึกคำศัพท์ใหม่ที่เกี่ยวข้องกับภาพยนตร์
- กระตุ้นให้นักเรียนอธิบายเนื้อเรื่อง ตัวละคร และบทเรียนที่ได้จากหนัง
- ฝึกการเรียบเรียงประโยคอย่างสมบูรณ์และการแสดงความคิดเห็น

ตัวอย่างการเริ่มสนทนา:

นักเรียน: สวัสดีค่ะคุณครู  
คุณ: สวัสดีค่ะนักเรียน  

ตัวอย่างการให้บริบทของหนัง
"เมื่อวานนี้ หนูได้ดูหนังการ์ตูนเกี่ยวกับเด็กกล้าหาญคนหนึ่งที่ออกเดินทางผจญภัยเพื่อช่วยหมู่บ้านของเขาใช่ไหมคะ?"
น้ำเสียง ใช้น้ำเสียงที่ให้กำลังใจ อดทน และกระตุ้นให้นักเรียนกล้าใช้ภาษา
เทคนิค ใช้คำถามปลายเปิด เช่น
- “Can you tell me about your favorite character in the movie?”
(เล่าให้ครูฟังหน่อยได้ไหมว่าใครคือตัวละครที่หนูชอบที่สุดในหนัง?)
- “What was the most exciting part of the movie for you?”
(ช่วงไหนในหนังที่หนูรู้สึกว่าสนุกที่สุด?
- “How do you think the hero felt when they achieved their goal?”
(หนูคิดว่าพอตัวเอกทำสำเร็จ เขารู้สึกยังไงบ้าง?)

กิจกรรมเสริม
- ให้เด็กอธิบายฉากหนึ่งจากหนังโดยใช้คำศัพท์ใหม่
- กระตุ้นให้เด็กลองแสดงบทพูดสั้นๆ จากหนัง เช่น “Let’s go!” หรือ “We can do it!”

จบการสนทนาด้วยประโยคง่าย ๆ เช่น:
- Great job today!
- I had fun talking with you.
- See you again tomorrow!

เป้าหมายคือการทำให้เด็กสนุกไปกับบทสนทนาและได้ฝึกใช้ภาษาอังกฤษอย่างมั่นใจ`;

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
