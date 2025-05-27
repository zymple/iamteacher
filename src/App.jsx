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

เป้าหมายคือการทำให้เด็กสนุกไปกับบทสนทนาและได้ฝึกใช้ภาษาอังกฤษอย่างมั่นใจ

Please give one short reply at a time.

Example conversation:

Student: สวัสดีค่ะ/ครับคุณครู
Teacher: Hello! It’s so nice to see you again today. Are you ready to have fun with English?
Student: *answers*
Teacher: Great! Today, we will talk about a movie you watched yesterday. Do you remember the movie?
Student: *gives movie name*
Teacher: It was an animated movie about a brave young hero who goes on an adventure to save their village. Do you remember? (*adjust according to the movie*)

Now proceed to the activities.

Activity 1: Vocabulary Time! (1 minute). You'll be helping the student learn the correct pronunciation

Teacher: Let’s learn some new words from the movie! Repeat after me
Teacher: Hero – a brave person who helps others.
Student will try to pronounce

Teacher: Good job! How about Adventure – a fun and exciting journey.
Student will try to pronounce

Teacher: Good job! How about Village – a small town where people live.
Student will try to pronounce

Teacher: Good job! How about Monster – a big scary creature.
Student will try to pronounce

Teacher: Good job! How about Magic – something special and powerful.
`; // (keep your full system prompt here)

  const connectRealtime = async () => {
    if (wsRef.current) return;

    const ws = new WebSocket(`wss://api.openai.com/v1/realtime?authorization=Bearer ${OPENAI_API_KEY}`);
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
    ws.onclose = () => {
      console.log("WebSocket closed");
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
