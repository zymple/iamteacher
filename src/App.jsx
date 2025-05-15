import React, { useState, useRef } from 'react';
import './App.css';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

function App() {
  const [transcript, setTranscript] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    audioChunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (e) => {
      audioChunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', audioBlob, 'input.webm');
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
            { role: 'system', content: 'You are an English tutor that is kind, fun to be around and can teach English language lessons through adventurous stories very well. You are assigned to talk with a primary school EFL student about a movie they watched yesterday.' },
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
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-end p-4">
      <h1>AI English Tutor</h1>
      <div>เว็บไซต์นี้เป็นการทำ Proof of concept ของการใช้ AI ในการสอนภาษาอังกฤษ โดยเน้นไปที่การจำลองการสื่อสารด้วยเสียง</div>
      <div>ครูมีทักษะเสริมสร้างจินตนาการ สนุก ตลก ให้ข้อคิด สามารถสอนเนื้อหาผ่านเรื่องราวการผจญภัยได้ดี เช่น คำศัพท์ หรือข้อคิด คำถามปลายเปิด เป็นต้น</div>
      <div>AI ได้รับบทให้พูดคุยกับนักเรียนในเรื่องภาพยนตร์ที่ได้รับชมไปเมื่อวาน</div>

      <h3>วิธีใช้งาน</h3>
      <div>กดปุ่ม Speak ด้านล่าง อนุญาตให้ใช้ไมโครโฟน พูดคุยกับ AI เป็นภาษาอังกฤษ แล้วกด Stop</div>
      <div>เริ่มจากการทักทายกับ AI แล้วเล่าให้ฟังว่าเมื่อวานรับชมภาพยนตร์เรื่องใดมา AI จะถามคุณเกี่ยวกับภาพยนตร์เรื่องนั้น</div>
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`mt-4 p-3 rounded-xl font-semibold text-white ${isRecording ? 'bg-red-500' : 'bg-blue-500'}`}
      >
        {isRecording ? 'Stop' : 'Speak'}
      </button>
      <div className="mb-2 bg-white rounded-2xl p-4 shadow text-sm">
        <div><strong>You:</strong> {transcript}</div>
        <div className="mt-2"><strong>Tutor:</strong> {aiReply}</div>
      </div>

    </div>
  );
}

export default App;