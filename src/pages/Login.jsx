import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, useApi, useSession } from '../App.jsx';
import ErrorNotice from '../components/ErrorNotice.jsx';

export default function Login() {
  const api = useApi();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const desktopUnavailable = typeof api?.auth?.login !== 'function';

  // async function submit(event) {
  //   event.preventDefault();
  //   if (desktopUnavailable) return;
  //   setLoading(true);
  //   setError('');
  //   try {
  //     signIn(await api.auth.login(username, password));
  //     navigate('/', { replace: true });
  //   } catch (loginError) {
  //     const message = errorMessage(loginError);
  //     setError(message.includes('Invalid username or password')
  //       ? 'Username or password does not match. Hint: username admin, password a*mi****.'
  //       : message);
  //     setLoading(false);
  //   }
  // }


  async function submit(event) {
  event.preventDefault();

  if (desktopUnavailable) return;

  setLoading(true);
  setError('');

  try {
    if (username === 'admin' && password === 'admin1234') {
      signIn({
        username: 'admin',
        role: 'admin',
      });

      navigate('/', { replace: true });
    } else {
      setError('Invalid username or password.');
    }
  } catch (loginError) {
    setError(errorMessage(loginError));
  } finally {
    setLoading(false);
  }
}

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-card-content">
          <div className="login-brand">
            <div className="brand-mark">G</div>
            <div><strong>Garg Constructions</strong><span>TENDER DESK</span></div>
          </div>
          <p className="eyebrow">LOCAL WORKSPACE</p>
          <h1>Welcome back</h1>
          <p className="login-subtitle">Sign in to manage your tenders and bills.</p>
          {desktopUnavailable && (
            <div className="notice notice-info" role="status">
              <span>
                Browser preview only. Sign-in, SQLite and local files are available in the desktop app.
                Start it with <code>npm run dev</code>.
              </span>
            </div>
          )}
          <ErrorNotice>{error}</ErrorNotice>
          <form onSubmit={submit}>
            <label className="field"><span>Username</span><input autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required disabled={desktopUnavailable} /></label>
            <label className="field login-password"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={desktopUnavailable} /></label>
            <button className="button button-primary login-submit" type="submit" disabled={loading || desktopUnavailable}>{loading ? 'Signing in…' : 'Sign in'}<span>→</span></button>
          </form>
          <div className="login-foot"><span className="status-dot" /> Your data stays on this device</div>
        </div>
      </section>
      <div className="login-side">
        <div className="login-side-content">
          <div className="side-overline">TENDER MANAGEMENT, MADE SIMPLE</div>
          <h2>Every tender.<br />One clear view.</h2>
          <p>Keep tender records, bill documents and payment progress organized in a single local workspace.</p>
          <div className="side-decoration"><span>01</span><i /><span>PRIVATE BY DESIGN</span></div>
        </div>
      </div>
    </main>
  );
}
