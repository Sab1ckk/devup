import {useLocation} from 'react-router-dom';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { Dialog, ErrorHint, Field, useUI } from "../components/UI";
import CodeStep from "./CodeStep";

export default function AuthDialog() {
  const location=useLocation();
  const destination=location.pathname==='/chat'?location.pathname+location.search:'/cabinet';
  const { setUser } = useAuth(),
    { close, toast } = useUI(),
    navigate = useNavigate();
  const [mode, setMode] = useState("login"),
    [step, setStep] = useState("credentials"),
    [challenge, setChallenge] = useState(null);
  const [values, setValues] = useState({
      email: "",
      password: "",
      number: "",
      claim_code: "",
    }),
    [code, setCode] = useState(""),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [wait, setWait] = useState(0),
    [offers, setOffers] = useState([]);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  const change = (e) =>
    setValues({ ...values, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (step === "credentials") {
        if (
          mode === "register" &&
          Boolean(values.number) !== Boolean(values.claim_code)
        )
          throw new Error(
            "Заполни номер заявки и код вместе или оставь оба поля пустыми.",
          );
        const data =
          mode === "register"
            ? values
            : { email: values.email, password: values.password };
        const result = await api(`/auth/${mode}`, data);
        setChallenge(result);
        setWait(result.resend_after);
        setCode("");
        setStep("code");
        setValues((v) => ({ ...v, password: "" }));
      } else if (step === "code") {
        const result = await api("/auth/verify", {
          challenge_id: challenge.challenge_id,
          code,
        });
        setUser({...result.user, sessionKey: crypto.randomUUID()});
        setCode("");
        setOffers(result.claimable);
        if (result.claimable.length) setStep("claim");
        else {
          close();
          setStep("credentials");
          navigate(destination);
          toast("Ты вошёл в аккаунт");
        }
      }
    } catch (err) {
      setError(err);
      if (err.retryAfter) setWait(err.retryAfter);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (wait || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api("/auth/resend", {
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
  async function apply() {
    setBusy(true);
    setError(null);
    try {
      await api("/claims/apply", { numbers: offers.map((p) => p.number) });
      finish();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  function finish() {
    close();
    setStep("credentials");
    navigate(destination);
  }
  return (
    <Dialog
      id="auth"
      title={
        step === "code"
          ? "Код из письма"
          : step === "claim"
            ? "Нашли заявки с этого устройства"
            : "Личный кабинет"
      }
      className="auth-dialog"
    >
      {step === "credentials" && (
        <div className="seg" role="radiogroup" aria-label="Режим">
          {[
            ["login", "Вход"],
            ["register", "Регистрация"],
          ].map(([value, title]) => (
            <label key={value}>
              <input
                type="radio"
                name="amode"
                value={value}
                checked={mode === value}
                onChange={() => {
                  setMode(value);
                  setError(null);
                }}
              />
              <span>{title}</span>
            </label>
          ))}
        </div>
      )}
      {step !== "claim" ? (
        <form onSubmit={submit}>
          {step === "credentials" ? (
            <>
              <Field
                label="Почта"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={values.email}
                onChange={change}
              />
              <Field
                label="Пароль"
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                required
                value={values.password}
                onChange={change}
                hint="Не меньше 10 символов"
              />
              {mode === "register" && (
                <>
                  <Field
                    label="Номер заявки · необязательно"
                    name="number"
                    placeholder="DEVUP-1001"
                    value={values.number}
                    onChange={change}
                  />
                  <Field
                    label="Код привязки · необязательно"
                    name="claim_code"
                    placeholder="XXXX-XXXX-XXXX"
                    value={values.claim_code}
                    onChange={change}
                  />
                  <p className="hint">
                    Заполняй оба поля или оставь пустыми. Код был на экране
                    после отправки заявки.
                  </p>
                </>
              )}
            </>
          ) : (
            <>
              <CodeStep value={code} onChange={setCode} mailId={challenge?.mail_id} message={<>Отправили код на {values.email}. Он действует 10 минут.</>} wait={wait} busy={busy} onResend={resend} onBack={()=>{setStep('credentials');setError(null);setCode('')}}/>
            </>
          )}
          <ErrorHint error={error} />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? "Подожди…"
              : step === "code"
                ? "Подтвердить"
                : mode === "register"
                  ? "Зарегистрироваться"
                  : "Войти"}
          </button>
        </form>
      ) : (
        <>
          <div className="review-list">
            {offers.map((p) => (
              <article key={p.number}>
                <h3>{p.display_number}</h3>
                <p>
                  {{site:'Сайт',app:'Android',small:'Мини-проект',study:'Учёба'}[p.project_type]} ·{" "}
                  {new Date(p.created_at).toLocaleDateString("ru")}
                </p>
              </article>
            ))}
          </div>
          <ErrorHint error={error} />
          <div className="cta">
            <button className="btn btn-primary" disabled={busy} onClick={apply}>
              Привязать
            </button>
            <button className="btn" onClick={finish}>
              Не сейчас
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}
