import AdminReviews from "./Reviews";
import PaletteToggle from '../../components/PaletteToggle';
import {AdminChats} from '../chat/AdminChats';
import usePolling from '../chat/usePolling';
import {intervals} from '../chat/constants';
import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useAdmin } from "../AdminContext";
import { api } from "../../lib/api";
import { ErrorHint, Field, useUI } from "../../components/UI";
import PalettePanel from "../../components/PalettePanel";
import useSiteEffects from "../../hooks/useSiteEffects";
import CodeStep from "../CodeStep";
import Services from "./Services";
import { PortfolioList, PortfolioEditor } from "./Portfolio";
import { RequestList, RequestDetail, UserList, UserDetail } from "./Records";

function Login() {
  const { accept, admin, expired } = useAdmin(),
    navigate = useNavigate();
  const [values, setValues] = useState({ username: "", password: "" }),
    [challenge, setChallenge] = useState(null),
    [code, setCode] = useState(""),
    [wait, setWait] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  if (admin) return <Navigate to="/admin/requests" replace />;
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!challenge) {
        const result = await api("/admin/auth/login", values);
        setChallenge(result);
        setWait(result.resend_after);
        setValues((v) => ({ ...v, password: "" }));
      } else {
        const result = await api("/admin/auth/verify", {
          challenge_id: challenge.challenge_id,
          code,
        });
        accept(result.admin);
        navigate("/admin/requests", { replace: true });
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const r = await api("/admin/auth/resend", {
        challenge_id: challenge.challenge_id,
      });
      setChallenge({ ...challenge, ...r });
      setWait(r.resend_after);
      setCode("");
    } catch (err) {
      setError(err);
      if (err.retryAfter) setWait(err.retryAfter);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sec admin-login auth-dialog">
      <h1 className="h2">
        {challenge ? "Код из письма" : "Вход в админ-панель"}
      </h1>
      {expired && (
        <p className="hint" role="status">
          Сессия истекла
        </p>
      )}
      <form className="form" onSubmit={submit}>
        {!challenge ? (
          <>
            <Field
              label="Логин"
              name="admin-username"
              autoComplete="username"
              minLength={3}
              maxLength={32}
              required
              value={values.username}
              onChange={(e) =>
                setValues({ ...values, username: e.target.value })
              }
            />
            <Field
              label="Пароль"
              name="admin-password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={128}
              required
              value={values.password}
              onChange={(e) =>
                setValues({ ...values, password: e.target.value })
              }
            />
          </>
        ) : (
          <>
            <CodeStep name="admin-code" value={code} onChange={setCode} mailId={challenge?.mail_id} message="Код отправлен на почту администратора. Он действует 10 минут." wait={wait} busy={busy} onResend={resend} onBack={()=>{setChallenge(null);setCode('');setError(null)}}/>
          </>
        )}
        <ErrorHint error={error} />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Подожди…" : challenge ? "Подтвердить" : "Войти"}
        </button>
      </form>
    </section>
  );
}
function Guard({ children }) {
  const { admin, loading } = useAdmin();
  if (loading) return <p role="status">Проверяем сессию…</p>;
  return admin ? children : <Navigate to="/admin/login" replace />;
}
export default function AdminApp() {
  const { admin, logout } = useAdmin(),
    { toast } = useUI(),
    navigate = useNavigate();
  const [unread,setUnread]=useState(0);
  usePolling(async()=>setUnread((await api('/admin/chat/unread')).unread),!!admin,intervals.manager);
  useSiteEffects();
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  const links = [
    ["requests", "Заявки"],
["chats", "Чаты"],
    ["users", "Пользователи"],
    ["services", "Услуги"],
    ["reviews", "Отзывы"],
    ["portfolio", "Портфолио"],
  ];
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#content">
        К содержимому
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="logo" to="/admin/requests">
            devup<sup>Админ</sup>
          </Link>
          <nav
            className="nav"
            id="site-navigation"
            aria-label="Разделы админки"
          >
            {admin &&
              links.map(([path, title]) => (
                <NavLink key={path} to={"/admin/" + path}>
                  {title}{path==='chats'&&unread>0&&<span className="chat-badge" aria-label={'Непрочитанных диалогов: '+unread}>{unread}</span>}
                </NavLink>
              ))}
          </nav>
          <div className="header-actions">
            <PaletteToggle />
            <a className="btn" href="/" target="_blank" rel="noreferrer">
              Открыть сайт
            </a>
            {admin && (
              <button
                className="btn"
                data-admin-logout=""
                onClick={() =>
                  logout()
                    .then(() => navigate("/admin/login"))
                    .catch((e) => toast(e.message))
                }
              >
                Выйти
              </button>
            )}
            <button
              className="menu-btn"
              type="button"
              aria-label="Открыть меню"
              aria-controls="site-navigation"
              aria-expanded="false"
              hidden={!admin}
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      <main className="main" id="content">
        <Routes>
          <Route path="login" element={<Login />} />
          <Route
            path="*"
            element={
              <Guard>
                <Routes>
                  <Route
                    index
                    element={<Navigate to="/admin/requests" replace />}
                  />
                  <Route path="chats" element={<AdminChats/>}/>
<Route path="chats/:id" element={<AdminChats/>}/>
<Route path="requests" element={<RequestList />} />
                  <Route path="requests/:number" element={<RequestDetail />} />
                  <Route path="users" element={<UserList />} />
                  <Route path="users/:id" element={<UserDetail />} />
                  <Route path="services" element={<Services />} />
                  <Route path="reviews" element={<AdminReviews />} />
                  <Route path="portfolio" element={<PortfolioList />} />
                  <Route path="portfolio/new" element={<PortfolioEditor />} />
                  <Route path="portfolio/:id" element={<PortfolioEditor />} />
                  <Route
                    path="*"
                    element={<Navigate to="/admin/requests" replace />}
                  />
                </Routes>
              </Guard>
            }
          />
        </Routes>

      </main>
      <PalettePanel />
    </div>
  );
}
