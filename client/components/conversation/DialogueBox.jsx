export default function DialogueBox({ aiReply }) {
  return (
    <div className="dialogue-box">
      <div className="dialogue-title">Teacher</div>
      <div className="dialogue-text">
        {aiReply || <a>กำลังรอคำถามของคุณ</a>}
      </div>
    </div>
  );
}