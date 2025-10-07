import { Translate } from "../../languages/TranslationsManager.jsx";

export default function StatusDisplay({ callDuration, webrtcLatency, openaiApiLatency, backendApiLatency, isSessionActive, formatDuration }) {
  return (
    <div style={{ marginTop: 10, textAlign: "center" }}>
      {isSessionActive && (
        <>
          <div>📞 <Translate>app.speak_screen.duration</Translate> {formatDuration(callDuration)}</div>
          {webrtcLatency !== null && (
            <div
              style={{
                marginTop: "0.5rem",
                color:
                  webrtcLatency < 150 ? "green" :
                  webrtcLatency < 300 ? "orange" : "red",
                fontWeight: 500,
              }}
            >
              ⏱️ WebRTC Latency: {webrtcLatency} ms
            </div>
          )}
        </>
      )}
      {openaiApiLatency !== null && (
        <div
          style={{
            marginTop: "0.5rem",
            color:
              openaiApiLatency < 300 ? "green" :
              openaiApiLatency < 600 ? "orange" : "red",
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
              backendApiLatency < 150 ? "green" :
              backendApiLatency < 300 ? "orange" : "red",
            fontWeight: 500,
          }}
        >
          🏠 TechTransThai: {backendApiLatency} ms
        </div>
      )}
    </div>
  );
}
