export default function ControlButton({ isRecording, isSessionActive, startSession, stopSession }) {
  return (
    <div className="button-container">
      <button
        onClick={async () => {
          if (isSessionActive) stopSession();
          else await startSession();
        }}
        className={`control-button ${isRecording ? "recording" : "idle"}`}
      >
        {isRecording ? "วางสาย" : "เริ่มการโทร"}
      </button>
    </div>
  );
}