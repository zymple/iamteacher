import { Translate } from "../../languages/TranslationsManager.jsx";

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
        {isRecording ? <Translate>app.speak_screen.end_call</Translate> : <Translate>app.speak_screen.start_call</Translate>}
      </button>
    </div>
  );
}