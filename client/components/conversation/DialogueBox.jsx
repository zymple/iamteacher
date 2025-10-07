import { Translate } from "../../languages/TranslationsManager.jsx";

export default function DialogueBox({ aiReply }) {
  return (
    <div className="dialogue-box">
      <div className="dialogue-title">Teacher</div>
      <div className="dialogue-text">
        {aiReply || <a><Translate>app.speak_screen.waiting_for_question</Translate></a>}
      </div>
    </div>
  );
}