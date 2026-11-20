import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Field, useUI } from "../../components/UI";
import { Conversation, ConversationList, PollError } from "./Conversation";
import { intervals } from "./constants";
import usePolling from "./usePolling";
import { useNavigate } from "react-router-dom";

const href = (t) => "/admin/chats/" + t.id;
export function AdminChats() {
  const { id } = useParams();
  const [result, setResult] = useState({ items: [], pages: 1 }),
    [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const error = usePolling(
    async () =>
      setResult(
        await api(
          "/admin/chat/threads?" +
            new URLSearchParams({ filter, q: query, page }),
        ),
      ),
    true,
    intervals.manager,
    intervals.manager,
    filter + query + page,
  );
  const detailError = usePolling(
    async () => setDetail(await api("/admin/chat/threads/" + id)),
    !!id,
    intervals.manager,
    intervals.manager,
    id,
  );
  const thread = detail?.id === id ? detail : null;
  return (
    <>
      <section className="pagehd">
        <h1>Чаты</h1>
      </section>
      <div className={"chat-page chat-live" + (id ? " has-thread" : "")}>
        <aside className="conversation-list">
          <h2>Диалоги</h2>
          <div className="filters">
            {Object.entries({
              all: "Все",
              unread: "Непрочитанные",
              request: "По заявкам",
              direct: "Прямые",
            }).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
              setPage(1);
            }}
          >
            <Field
              label="Номер заявки или почта"
              name="chat-search"
              maxLength={320}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-sm">Найти</button>
          </form>
          <PollError error={error} />
          <ConversationList
            threads={result.items}
            href={href}
            selected={id && href({ id })}
          />
          {!result.items.length && (
            <p className="empty-state-note">Диалогов пока нет.</p>
          )}
          <div className="cta">
            <button
              className="btn btn-sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Назад
            </button>
            <button
              className="btn btn-sm"
              disabled={page >= result.pages}
              onClick={() => setPage(page + 1)}
            >
              Вперёд
            </button>
          </div>
        </aside>
        {thread ? (
          <Conversation
            key={id}
            endpoint={"/admin/chat/threads/" + id}
            thread={thread}
            owner={thread.owner}
            manager
            back="/admin/chats"
          />
        ) : (
          <section className="conversation">
            <div className="chat-empty-body">
              {id ? (
                <>
                  <Link to="/admin/chats">К списку диалогов</Link>
                  <PollError error={detailError} />
                  {!detailError && "Загружаем диалог…"}
                </>
              ) : (
                "Выбери диалог"
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
export function OpenChat({ target, disabled = false }) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate(),
    { toast } = useUI();
  async function open() {
    setBusy(true);
    try {
      navigate(href(await api("/admin/chat/threads/ensure", target)));
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button className="btn" disabled={disabled || busy} onClick={open}>
        Открыть чат
      </button>
      {disabled && (
        <p className="hint">
          {target.request_number
            ? "У заявки нет владельца"
            : "Почта клиента не подтверждена"}
        </p>
      )}
    </div>
  );
}
