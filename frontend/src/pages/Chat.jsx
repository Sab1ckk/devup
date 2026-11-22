import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../features/AuthContext";
import { useUI } from "../components/UI";
import {
  Conversation,
  ConversationList,
  PollError,
} from "../features/chat/Conversation";
import { intervals, threadKey } from "../features/chat/constants";
import usePolling from "../features/chat/usePolling";

const href = (t) => "/chat?thread=" + threadKey(t);
export default function Chat() {
  const { user, loading } = useAuth(),
    { open } = useUI(),
    [params] = useSearchParams();
  const autoLogin = params.get("login") === "1";
  useEffect(() => {
    if (!loading && !user && autoLogin) open("auth");
  }, [loading, user, autoLogin, open]);
  return user ? (
    <SignedInChat
      key={user.sessionKey ?? user.id}
      user={user}
      params={params}
      open={open}
    />
  ) : (
    <section className="chat-empty-body">
      <p>
        {loading
          ? "Проверяем сессию…"
          : "Чтобы написать менеджеру, нужен аккаунт"}
      </p>
      {!loading && (
        <button className="btn btn-primary" onClick={() => open("auth")}>
          Войти
        </button>
      )}
    </section>
  );
}
function SignedInChat({ user, params, open }) {
  const [threads, setThreads] = useState([]);
  const selected = params.get("thread")?.toLowerCase();
  const match = selected?.match(/^devup-(\d+)$/);
  const thread =
    selected === "direct"
      ? { kind: "direct" }
      : match
        ? { kind: "request", request_number: Number(match[1]) }
        : null;
  const error = usePolling(
    async () => setThreads(await api("/chat/threads")),
    !!user,
    intervals.client,
  );
  if (error?.status === 401)
    return (
      <section className="chat-empty-body">
        <PollError error={error} />
        <button className="btn btn-primary" onClick={() => open("auth")}>
          Войти
        </button>
      </section>
    );
  const items = threads.length ? threads : [{ kind: "direct" }];
  return (
    <div className={"chat-page chat-live" + (thread ? " has-thread" : "")}>
      <aside className="conversation-list">
        <h2>Диалоги</h2>
        <ConversationList
          threads={items}
          href={href}
          selected={thread && href(thread)}
        />
        <PollError error={error} />
      </aside>
      {thread ? (
        <Conversation
          key={selected + user.id}
          endpoint={match ? "/chat/requests/" + match[1] : "/chat/direct"}
          thread={thread}
          owner={match ? user : null}
          back="/chat"
          onLogin={() => open("auth")}
        />
      ) : (
        <section className="conversation chat-placeholder">
          <p className="chat-empty-body">Диалог не выбран</p>
        </section>
      )}
    </div>
  );
}
