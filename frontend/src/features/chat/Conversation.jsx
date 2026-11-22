import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { ErrorHint } from "../../components/UI";
import usePolling from "./usePolling";
import { intervals, CHAT_CHANGED, threadTitle } from "./constants";

export function PollError({ error }) {
  if (!error) return null;
  return (
    <ErrorHint
      error={
        error.status === 401
          ? "Сессия закончилась. Требуется повторная авторизация."
          : error.status === 404
            ? "Диалог не найден."
            : "Нет связи, пробуем ещё раз"
      }
    />
  );
}
export function ConversationList({ threads, href, selected, onSelect }) {
  return (
    <ul className="chat-threads">
      {threads.map((thread) => {
        const to = href(thread);
        return (
          <li key={to}>
            <Link
              to={to}
              onClick={onSelect}
              aria-current={selected === to ? "page" : undefined}
            >
              <strong>{threadTitle(thread)}</strong>
              {thread.owner && (
                <span className="hint">{thread.owner.email}</span>
              )}
              {thread.status && (
                <span className="up">
                  {
                    {
                      new: "Новая",
                      estimating: "Оценка",
                      agreed: "Согласована",
                      in_progress: "В работе",
                      done: "Готова",
                      cancelled: "Отменена",
                    }[thread.status]
                  }
                </span>
              )}
              {thread.last_message && (
                <span className="chat-excerpt">{thread.last_message.body}</span>
              )}
              {!!thread.unread && (
                <span
                  className="chat-badge"
                  aria-label={"Непрочитанных: " + thread.unread}
                >
                  {thread.unread}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
const merge = (old, fresh) =>
  [...new Map([...old, ...fresh].map((m) => [m.id, m])).values()].sort(
    (a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1),
  );
const changed = () => window.dispatchEvent(new Event(CHAT_CHANGED));

export function Conversation({
  endpoint,
  thread,
  manager = false,
  back,
  owner,
  onLogin,
}) {
  const [rows, setRows] = useState([]),
    [more, setMore] = useState(false),
    [draft, setDraft] = useState("");
  const [pending, setPending] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null);
  const [jump, setJump] = useState(false),
    [loaded, setLoaded] = useState(false);
  const cursor = useRef(null),
    readCursor = useRef(null),
    readAgain = useRef(null);
  const alive = useRef(true),
    scroller = useRef(null),
    field = useRef(null),
    atBottom = useRef(true),
    restore = useRef(null),
    paging = useRef(false),
    sending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const pollError = usePolling(
    async () => {
      const previous = cursor.current;
      const result = await api(
        endpoint + "/messages" + (previous ? "?after=" + previous : ""),
      );
      if (!alive.current) return;
      if (!previous) setMore(result.has_more_before);
      if (result.messages.length) {
        cursor.current = result.messages.at(-1).id;
        setRows((old) => merge(old, result.messages));
        if (!atBottom.current) setJump(true);
      }
      setLoaded(true);
      const last = cursor.current;
      if (
        !document.hidden &&
        (readCursor.current !== last || readAgain.current === null)
      ) {
        await api(endpoint + "/read", last ? { through: last } : {});
        readCursor.current = last;
        readAgain.current = true;
        changed();
      }
    },
    true,
    intervals.messages,
    intervals.hidden,
  );
  useLayoutEffect(() => {
    const node = scroller.current;
    if (restore.current !== null) {
      node.scrollTop = node.scrollHeight - restore.current;
      restore.current = null;
    } else if (atBottom.current) node.scrollTop = node.scrollHeight;
  }, [rows, pending]);
  useEffect(() => {
    if (!busy && pending === null) field.current?.focus();
  }, [busy, pending]);
  async function older() {
    if (!more || !rows.length || paging.current) return;
    paging.current = true;
    try {
      const result = await api(endpoint + "/messages?before=" + rows[0].id);
      if (!alive.current) return;
      restore.current =
        scroller.current.scrollHeight - scroller.current.scrollTop;
      setRows((old) => merge(old, result.messages));
      setMore(result.has_more_before);
    } catch (err) {
      setError(err);
    } finally {
      paging.current = false;
    }
  }
  async function send(item) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setPending(item);
    setError(null);
    try {
      const row = await api(endpoint + "/messages", {
        body: item.body,
        client_msg_id: item.client_msg_id,
      });
      if (!alive.current) return;
      setRows((old) => merge(old, [row]));
      setPending(null);
      changed();
    } catch (err) {
      if (alive.current) setError(err);
    } finally {
      sending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function submit(event) {
    event.preventDefault();
    if (!draft.trim() || pending || busy || pollError?.status === 401) return;
    atBottom.current = true;
    send({ body: draft.trim(), client_msg_id: crypto.randomUUID() });
    setDraft("");
  }
  const own = manager ? "manager" : "me";
  const visibleRows =
    pending && !rows.some((m) => m.client_msg_id === pending.client_msg_id)
      ? [
          ...rows,
          {
            ...pending,
            id: "pending",
            from: own,
            created_at: new Date().toISOString(),
          },
        ]
      : rows;
  return (
    <section className="conversation">
      <header>
        <Link className="btn btn-sm chat-back" to={back}>
          К списку диалогов
        </Link>
        <h2 className="h2">{threadTitle(thread)}</h2>
        {manager && (
          <p className="up">
            {thread.kind === "request" ? "По заявке" : "Прямой"}
          </p>
        )}
        {manager && thread.request_number && (
          <Link className="up" to={"/admin/requests/" + thread.request_number}>
            DEVUP-{thread.request_number}
          </Link>
        )}
        {owner && (
          <p>
            Владелец:{" "}
            {manager ? (
              <Link to={"/admin/users/" + owner.id}>{owner.email}</Link>
            ) : (
              owner.email
            )}
          </p>
        )}
      </header>
      <div
        className="chat-log"
        ref={scroller}
        role="log"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          if (atBottom.current) setJump(false);
          if (el.scrollTop < 30 && !atBottom.current) older();
        }}
      >
        {more && (
          <button className="btn btn-sm" type="button" onClick={older}>
            Ранние сообщения
          </button>
        )}
        {!visibleRows.length && (
          <div className="chat-empty-body">
            {!loaded
              ? "Загружаем переписку…"
              : thread.kind === "direct"
                ? "Здесь может быть отправлен вопрос менеджеру."
                : "Здесь можно задать вопрос по заявке DEVUP-" +
                  thread.request_number}
          </div>
        )}
        {visibleRows.map((message, index) => {
          const date = new Date(message.created_at);
          const currentDay = date.toLocaleDateString("ru-RU");
          const separator =
            index === 0 ||
            new Date(visibleRows[index - 1].created_at).toLocaleDateString(
              "ru-RU",
            ) !== currentDay;
          return (
            <div className="chat-row" key={message.id}>
              {separator && <p className="chat-date up">{currentDay}</p>}
              <article
                className={
                  "chat-message" + (message.from === own ? " own" : "")
                }
              >
                {message.from === "manager" && (
                  <span className="up">Менеджер DEVUP</span>
                )}
                <p>{message.body}</p>
                <time className="up" dateTime={message.created_at}>
                  {date.toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                {message.id === "pending" && (
                  <span className="up">
                    {busy ? " Отправляем…" : " Не подтверждено"}
                  </span>
                )}
              </article>
            </div>
          );
        })}
      </div>
      {jump && (
        <button
          className="btn btn-sm"
          onClick={() => {
            atBottom.current = true;
            scroller.current.scrollTop = scroller.current.scrollHeight;
            setJump(false);
          }}
        >
          Новые сообщения
        </button>
      )}
      <PollError error={pollError} />
      {pollError?.status === 401 && onLogin && (
        <button className="btn" onClick={onLogin}>
          Войти
        </button>
      )}
      <ErrorHint
        error={
          error?.status === 429
            ? error.message + " Повтори через " + error.retryAfter + " с."
            : error?.message
        }
      />
      {pending && !busy && (
        <button
          className="btn btn-sm"
          type="button"
          onClick={() => send(pending)}
        >
          Повторить отправку
        </button>
      )}
      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-body">
          Сообщение
        </label>
        <textarea
          id="chat-body"
          ref={field}
          value={draft}
          maxLength={2000}
          placeholder="Сообщение"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing)
              submit(e);
          }}
        />
        {draft.length >= 1800 && (
          <span className="up">{draft.length}/2000</span>
        )}
        <button
          className="btn btn-primary"
          disabled={
            !draft.trim() ||
            busy ||
            !!pending ||
            pollError?.status === 401 ||
            pollError?.status === 404
          }
        >
          Отправить
        </button>
      </form>
    </section>
  );
}
