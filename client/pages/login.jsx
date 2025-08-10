import '../Login.css';

function Login() {
  return (
    <div className="app-container">
      <img src="/assets/tutor_f.png" alt="Tutor Avatar" className="avatar" />
      <div className="text-container">
        <p className="tutor-name">AI English Tutor</p>
        <p className="tutor-description">Improve your English while still having fun!</p>
      </div>

      <form className="login-form">
        <div className="button-container">
          <button className="control-button idle">
            Sign in with Google
          </button>
          <button className="control-button idle">
            Sign in with Email
          </button>
          <button className="control-button idle">
            Use without account
          </button>
        </div>
      </form>
    </div>
  );
}

export default Login;
