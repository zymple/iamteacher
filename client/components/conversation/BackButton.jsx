export default function BackButton() {
  const handleBack = () => {
    if (window.location.pathname === "/lesson") {
      window.location.href = "/";
    } else {
      window.location.href = "/lesson";
    }
  };

  return (
    <div className="back" onClick={handleBack}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 16 16" 
        width="24" 
        height="24" 
        style={{ display: "block" }}
      >
        <path
          d="m 12 2 c 0 -0.265625 -0.105469 -0.519531 -0.292969 -0.707031 c -0.390625 -0.390625 -1.023437 -0.390625 -1.414062 0 l -6 6 c -0.1875 0.1875 -0.292969 0.441406 -0.292969 0.707031 s 0.105469 0.519531 0.292969 0.707031 l 6 6 c 0.390625 0.390625 1.023437 0.390625 1.414062 0 c 0.1875 -0.1875 0.292969 -0.441406 0.292969 -0.707031 s -0.105469 -0.519531 -0.292969 -0.707031 l -5.292969 -5.292969 l 5.292969 -5.292969 c 0.1875 -0.1875 0.292969 -0.441406 0.292969 -0.707031 z"
          fill="#2e3436"
        />
      </svg>
    </div>
  );
}