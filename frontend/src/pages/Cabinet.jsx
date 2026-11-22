import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../features/AuthContext";
import { Dialog, ErrorHint, Field, useUI } from "../components/UI";
const statuses = {
  new: "Новая",
  estimating: "Оценка",
  agreed: "Согласована",
  in_progress: "В работе",
  done: "Готова",
  cancelled: "Отменена",
};
const types = {
  site: "Сайт",
  app: "Android",
  small: "Мини-проект",
  study: "Учёба",
};
function date(value) {
  return new Date(value).toLocaleString("ru");
}
function ClaimDialog({ refresh }) {
  const { toast } = useUI(),
    [candidates, setCandidates] = useState([]),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [values, setValues] = useState({ number: "", claim_code: "" });
  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog id="claim" title="Подгрузить заявки">
      <button
        className="btn"
        disabled={busy}
        onClick={() =>
          run(async () => {
            const r = await api("/claims/discover", {});
            setCandidates(r);
            if (!r.length) toast("Свободных заявок не нашли");
          })
        }
      >
        Найти мои заявки
      </button>
      <p className="hint">
        Ищем заявки этого браузера и заявки с подтверждённой почтой аккаунта.
      </p>
      <div className="review-list">
        {candidates.map((p) => (
          <article key={p.number}>
            <h3>{p.display_number}</h3>
            <p>
              {types[p.project_type]} · {date(p.created_at)}
            </p>
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const r = await api("/claims/apply", { numbers: [p.number] });
                  setCandidates(
                    candidates.filter((x) => x.number !== p.number),
                  );
                  await refresh();
                  toast(
                    r.claimed.length
                      ? "Заявка привязана"
                      : "Заявка уже привязана",
                  );
                })
              }
            >
              Привязать
            </button>
          </article>
        ))}
      </div>
      <h3>Привязать по номеру и коду</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/claims/by-code", values);
            setValues({ number: "", claim_code: "" });
            await refresh();
            toast("Заявка привязана");
          });
        }}
      >
        <Field
          label="Номер заявки"
          name="claim-number"
          required
          value={values.number}
          onChange={(e) => setValues({ ...values, number: e.target.value })}
          placeholder="DEVUP-1001"
        />
        <Field
          label="Код привязки"
          name="claim-code"
          required
          value={values.claim_code}
          onChange={(e) => setValues({ ...values, claim_code: e.target.value })}
          placeholder="XXXX-XXXX-XXXX"
        />
        <button className="btn btn-primary" disabled={busy}>
          Привязать
        </button>
      </form>
      <ErrorHint error={error} />
    </Dialog>
  );
}
function RequestDetail({ detail }) {
  const {close}=useUI();
  return (
    <Dialog
      id="detail"
      title={detail?.display_number || "Заявка"}
      className="request-detail"
    >
      {detail && (
        <>
          <p className="up">
            {types[detail.project_type]} · {statuses[detail.status]}
          </p>
          {[
            ["company_text", "О компании и задаче"],
            ["wishes_text", "Пожелания"],
            ["design_text", "Дизайн и примеры"],
            ["deadline_text", "Сроки"],
            ["budget_text", "Бюджет"],
          ].map(
            ([key, title]) =>
              detail[key] && (
                <section key={key}>
                  <h3>{title}</h3>
                  <p className="user-text">{detail[key]}</p>
                </section>
              ),
          )}
          <h3>Структура проекта</h3>
          <div className="request-detail-blocks">
            {detail.blocks.map((b) => (
              <article key={b.position}>
                <span className="up">
                  {String(b.position + 1).padStart(2, "0")}
                </span>
                <h3>{b.title}</h3>
                <p className="user-text">{b.description}</p>
              </article>
            ))}
          </div>
          <h3>Контакты</h3>
          {detail.contacts.map((c) => (
            <p key={c.kind}>
              {{email:'Почта',telegram:'Telegram',vk:'ВКонтакте'}[c.kind]}: {c.value}
            </p>
          ))}
          <h3>История статусов</h3>
          <ol className="process-timeline">
            {detail.history.map((h, i) => (
              <li className="timeline-step" key={i}>
                <span className="up">{date(h.created_at)}</span>
                <h3>{statuses[h.to_status]}</h3>
                {h.comment && <p>{h.comment}</p>}
              </li>
            ))}
          </ol>
          <Link className="btn" to={'/chat?thread=devup-'+detail.number} onClick={()=>close()}>Чат по заявке</Link>
        </>
      )}
    </Dialog>
  );
}
export default function Cabinet() {
  const { user, loading, logout } = useAuth(),
    { open } = useUI(),
    [requests, setRequests] = useState([]),
    [error, setError] = useState(null),
    [detail, setDetail] = useState(null);
  const refresh = useCallback(async () => {
    setRequests(await api("/requests/mine"));
  }, []);
  useEffect(() => {
    if (!loading && !user) open("auth");
  }, [loading, user, open]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    api("/requests/mine")
      .then((rows) => {
        if (active) setRequests(rows);
      })
      .catch((err) => {
        if (active) setError(err);
      });
    return () => {
      active = false;
    };
  }, [user]);
  async function show(number) {
    setError(null);
    try {
      setDetail(await api(`/requests/${number}`));
      open("detail");
    } catch (err) {
      setError(err);
    }
  }
  if (loading)
    return (
      <section className="sec">
        <p role="status">Загружаем кабинет…</p>
      </section>
    );
  if (!user)
    return (
      <section className="pagehd">
        <h1>Кабинет</h1>
        <p>Просмотр заявок доступен после авторизации.</p>
        <button className="btn btn-primary" onClick={() => open("auth")}>
          Войти
        </button>
      </section>
    );
  return (
    <>
      <section className="pagehd">
        <h1>Кабинет</h1>
        <div className="cabinet-account"><p>{user.email}</p>
        <button className="btn btn-sm" onClick={() => logout().catch(setError)}>
          Выйти
        </button></div>
      </section>
      <section className="sec">
        <div className="sec-top">
          <h2 className="h2">Мои заявки</h2>
          <button className="btn btn-sm" onClick={() => open("claim")}>
            Подгрузить заявки
          </button>
        </div>
        <ErrorHint error={error} />
        {requests.length ? (
          <div className="review-list request-list">
            {requests.map((p) => (
              <article key={p.number}>
                <h2 className="code">{p.display_number}</h2>
                <p className="up">
                  {types[p.project_type]}{" "}
                  <span className="request-status">{statuses[p.status]}</span>
                </p>
                <time dateTime={p.created_at}>{date(p.created_at)}</time>
                <p>{p.company_text.slice(0, 180)}</p>
                <button className="btn btn-sm" onClick={() => show(p.number)}>
                  Подробнее
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="portfolio-empty">
            <p>Заявок пока нет.</p>
            <Link className="btn btn-primary" to="/order">
              Оставить заявку
            </Link>
          </div>
        )}
      </section>
      <ClaimDialog refresh={refresh} />
      <RequestDetail detail={detail} />
    </>
  );
}
