import {OpenChat} from '../chat/AdminChats';
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Dialog, ErrorHint, Field, useUI } from "../../components/UI";
const types = {
  site: "Сайт",
  app: "Android",
  small: "Мини-проект",
  study: "Учёба",
};
const statuses = {
  new: "Новая",
  estimating: "Оценка",
  agreed: "Согласование",
  in_progress: "Разработка",
  done: "Сдана",
  cancelled: "Отменена",
};
const contactLabels = {
  tg: "Телеграм",
  telegram: "Телеграм",
  vk: "Вконтакте",
  email: "Почта",
  max: "MAX",
};
const date = (value) => (value ? new Date(value).toLocaleString("ru") : "—");
function useResource(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    setData(await api(path));
  }, [path]);
  useEffect(() => {
    let live = true;
    api(path)
      .then((r) => {
        if (live) setData(r);
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, [path]);
  return { data, error, refresh };
}
function Pagination({ data, page, setPage }) {
  return (
    data && (
      <div className="cta admin-pagination">
        <button
          className="btn btn-sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Назад
        </button>
        <span className="up">
          {page} / {data.pages}
        </span>
        <button
          className="btn btn-sm"
          disabled={page >= data.pages}
          onClick={() => setPage(page + 1)}
        >
          Вперёд
        </button>
      </div>
    )
  );
}
function Search({
  value,
  setValue,
  onSubmit,
  label = "Поиск по номеру или контакту",
}) {
  return (
    <form
      className="admin-search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Field
        label={label}
        name="admin-search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={320}
      />
      <button className="btn btn-sm">Найти</button>
    </form>
  );
}
function RequestCards({ rows }) {
  return (
    <div className="review-list request-list">
      {rows.map((p) => (
        <article key={p.number}>
          <h2 className="code">
            <Link to={"/admin/requests/" + p.number}>{p.display_number}</Link>
          </h2>
          <p className="up">
            {types[p.project_type]} ·{" "}
            <span className="request-status">{statuses[p.status]}</span>
          </p>
          <time dateTime={p.created_at}>{date(p.created_at)}</time>
          {"owner" in p && <p>{p.owner?.email || "Гость"}</p>}
          {p.contacts?.map((c) => (
            <p key={c.kind}>{c.value}</p>
          ))}
        </article>
      ))}
    </div>
  );
}
export function RequestList() {
  const [status, setStatus] = useState(""),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [unclaimed, setUnclaimed] = useState(false);
  const { data, error } = useResource(
    "/admin/requests?" +
      new URLSearchParams({
        ...(status ? { status } : {}),
        q: search,
        page,
        unclaimed,
      }),
  );
  return (
    <>
      <section className="pagehd">
        <h1>Заявки</h1>
      </section>
      <div className="filters">
        {[["", "Все"], ...Object.entries(statuses)].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={status === key}
            onClick={() => {
              setStatus(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <Search
        value={q}
        setValue={setQ}
        onSubmit={() => {
          setSearch(q);
          setPage(1);
        }}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={unclaimed}
          onChange={(e) => {
            setUnclaimed(e.target.checked);
            setPage(1);
          }}
        />
        <span>Только без владельца</span>
      </label>
      <ErrorHint error={error} />
      {data ? (
        <section className="sec">
          {data.items.length ? (
            <RequestCards rows={data.items} />
          ) : (
            <p className="portfolio-empty">Заявок не нашли.</p>
          )}
          <Pagination data={data} page={page} setPage={setPage} />
        </section>
      ) : (
        !error && <p role="status">Загружаем заявки…</p>
      )}
    </>
  );
}
function ClaimPicker({ user, request, refresh }) {
  const [q, setQ] = useState(""),
    [rows, setRows] = useState([]),
    [choice, setChoice] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    { open, close, toast } = useUI();
  async function search() {
    setError(null);
    try {
      const r = await api(
        (user ? "/admin/requests?unclaimed=true&q=" : "/admin/users?q=") +
          encodeURIComponent(q),
      );
      setRows(r.items);
    } catch (err) {
      setError(err);
    }
  }
  const pickedRequest = request || choice,
    pickedUser = user || choice;
  async function apply() {
    setBusy(true);
    try {
      await api(`/admin/requests/${pickedRequest.number}/claim`, {
        user_id: pickedUser.id,
      });
      close();
      setChoice(null);
      setRows([]);
      await refresh();
      toast("Заявка привязана");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="sec">
      <h2 className="h2">
        {user ? "Привязать заявку" : "Привязать к пользователю"}
      </h2>
      <Search
        value={q}
        setValue={setQ}
        onSubmit={search}
        label={user ? "Номер или контакт" : "Почта клиента"}
      />
      <div className="review-list">
        {rows.map((row) => (
          <article key={row.id || row.number}>
            <p>{row.email || row.display_number}</p>
            <button
              className="btn btn-sm"
              disabled={!user && !row.verified}
              onClick={() => {
                setChoice(row);
                open("admin-confirm-claim");
              }}
            >
              Выбрать
            </button>
          </article>
        ))}
      </div>
      <ErrorHint error={error} />
      <Dialog id="admin-confirm-claim" title="Привязать заявку?">
        {choice && (
          <>
            <p>
              Привязать {pickedRequest.display_number} к {pickedUser.email}?
            </p>
            <ErrorHint error={error} />
            <div className="cta">
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={apply}
              >
                Привязать
              </button>
              <button className="btn" onClick={close}>
                Отмена
              </button>
            </div>
          </>
        )}
      </Dialog>
    </section>
  );
}
function RequestBody({ data, refresh }) {
  const [status, setStatus] = useState(data.status),
    [comment, setComment] = useState(""),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [secret, setSecret] = useState(null),
    { open, toast } = useUI();
  async function change(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/requests/${data.number}/status`, { status, comment });
      await refresh();
      setComment("");
      toast("Статус изменён");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function newCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await api(`/admin/requests/${data.number}/claim-code`, {});
      setSecret(r.claim_code);
      open("admin-code");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(data.display_number + "\n" + secret);
      toast("Номер и код скопированы");
    } catch {
      toast("Выдели код и скопируй его вручную");
    }
  }
  return (
    <>
      <section className="pagehd">
        <h1 className="h2">{data.display_number}</h1>
<OpenChat target={{request_number:data.number}} disabled={!data.owner}/>
        <p>
          {types[data.project_type]} · {statuses[data.status]} ·{" "}
          {date(data.created_at)}
        </p>
        <p>
          Владелец:{" "}
          {data.owner ? (
            <Link to={"/admin/users/" + data.owner.id}>{data.owner.email}</Link>
          ) : (
            "Гость"
          )}
        </p>
      </section>
      <section className="sec">
        {[
          ["company_text", "О компании и задаче"],
          ["wishes_text", "Пожелания"],
          ["design_text", "Дизайн"],
          ["deadline_text", "Сроки"],
          ["budget_text", "Бюджет"],
        ].map(
          ([key, label]) =>
            data[key] && (
              <div key={key} className="admin-text request-copy">
                <h2 className="h2">{label}</h2>
                <p className="user-text">{data[key]}</p>
              </div>
            ),
        )}
        <h2 className="h2 request-section-title">Контакты</h2>
        <div className="request-contacts">
          {data.contacts.map((c) => (
            <p key={c.kind} className="request-contact-item">
              <span className="up request-contact-kind user-text">
                {contactLabels[c.kind] || c.kind}:
              </span>
              <span className="user-text">{c.value}</span>
            </p>
          ))}
        </div>
        <h2 className="h2 request-section-title request-structure-title">
          Структура проекта
        </h2>
        <div className="review-list request-block-descriptions">
          {data.blocks.map((b) => (
            <article key={b.position}>
              <span className="up">{b.position + 1}</span>
              <h3>{b.title}</h3>
              <p className="user-text">{b.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="sec">
        <h2 className="h2">История статусов</h2>
        <ol className="process-timeline">
          {data.history.map((h, i) => (
            <li className="timeline-step" key={i}>
              <span className="up">{date(h.created_at)}</span>
              <h3>{statuses[h.to_status]}</h3>
              <p>{h.actor || "Система"}</p>
              <p className="user-text">{h.comment}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="sec">
        <h2 className="h2">Сменить статус</h2>
        <form className="form" onSubmit={change}>
          <label className="fl">
            <span>Статус</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(statuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="fl">
            <span>Комментарий · только для админки</span>
            <textarea
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <ErrorHint error={error} />
          <button className="btn btn-primary" disabled={busy}>
            Сменить статус
          </button>
        </form>
      </section>
      {!data.owner && (
        <>
          <button className="btn" disabled={busy} onClick={newCode}>
            Выдать новый код привязки
          </button>
          <ClaimPicker request={data} refresh={refresh} />
        </>
      )}
      <Dialog
        id="admin-code"
        title="Новый код привязки"
        onClosed={() => setSecret(null)}
      >
        <p className="code">{data.display_number}</p>
        <p className="claim-secret code">{secret}</p>
        <p>
          Код должен быть сохранён. Он отображается один раз. Прежний код больше не работает.
        </p>
        <button className="btn" onClick={copy}>
          Скопировать
        </button>
      </Dialog>
    </>
  );
}
export function RequestDetail() {
  const { number } = useParams(),
    { data, error, refresh } = useResource("/admin/requests/" + number);
  return (
    <>
      <ErrorHint error={error} />
      {data ? (
        <RequestBody key={number} data={data} refresh={refresh} />
      ) : (
        !error && <p role="status">Загружаем заявку…</p>
      )}
    </>
  );
}
export function UserList() {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    { data, error } = useResource(
      "/admin/users?" + new URLSearchParams({ q: search, page }),
    );
  return (
    <>
      <section className="pagehd">
        <h1>Пользователи</h1>
      </section>
      <Search
        value={q}
        setValue={setQ}
        label="Поиск по почте"
        onSubmit={() => {
          setSearch(q);
          setPage(1);
        }}
      />
      <ErrorHint error={error} />
      {data ? (
        <section className="sec">
          <div className="review-list">
            {data.items.map((u) => (
              <article key={u.id}>
                <h2>
                  <Link to={"/admin/users/" + u.id}>{u.email}</Link>
                </h2>
                <p>
                  {u.verified ? "Почта подтверждена" : "Почта не подтверждена"}
                </p>
                <p>Регистрация: {date(u.created_at)}</p>
                <p>Последний вход: {date(u.last_login_at)}</p>
                <p>Заявок: {u.request_count}</p>
              </article>
            ))}
          </div>
          {!data.items.length && <p>Пользователей не нашли.</p>}
          <Pagination data={data} page={page} setPage={setPage} />
        </section>
      ) : (
        !error && <p role="status">Загружаем пользователей…</p>
      )}
    </>
  );
}
export function UserDetail() {
  const { id } = useParams(),
    { data, error, refresh } = useResource("/admin/users/" + id);
  return (
    <>
      <ErrorHint error={error} />
      {data ? (
        <>
          <section className="pagehd">
            <h1 className="h2">{data.email}</h1>
<OpenChat target={{user_id:data.id}} disabled={!data.verified}/>
            <p>
              {data.verified ? "Почта подтверждена" : "Почта не подтверждена"}
            </p>
            <p>
              Регистрация: {date(data.created_at)} · Последний вход:{" "}
              {date(data.last_login_at)}
            </p>
          </section>
          <section className="sec">
            <h2 className="h2">Заявки пользователя</h2>
            <RequestCards rows={data.requests} />
            {!data.requests.length && <p>Заявок пока нет.</p>}
          </section>
          {data.verified && <ClaimPicker user={data} refresh={refresh} />}
        </>
      ) : (
        !error && <p role="status">Загружаем пользователя…</p>
      )}
    </>
  );
}
