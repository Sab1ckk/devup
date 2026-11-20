import { useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../AuthContext";
import { Dialog, useUI } from "../../components/UI";
import { ConversationList, PollError } from "./Conversation";
import usePolling from "./usePolling";
import { intervals, threadKey } from "./constants";
export default function QuickChat() {
  const { user } = useAuth(),
    { dialog, open, close } = useUI();
  const [unread, setUnread] = useState(0),
    [threads, setThreads] = useState([]);
  const sessionError = usePolling(
    async () => setUnread((await api("/chat/unread")).unread),
    !!user,
    intervals.client,
    intervals.client,
    user?.sessionKey ?? user?.id,
  );
  const signedIn = !!user && sessionError?.status !== 401;
  const error = usePolling(
    async () => {
      const rows = await api("/chat/threads");
      setThreads(
        rows
          .filter((t) => t.last_message)
          .sort(
            (a, b) =>
              Date.parse(b.last_message.created_at) -
              Date.parse(a.last_message.created_at),
          )
          .slice(0, 5),
      );
    },
    signedIn && dialog === "quick-chat",
    intervals.client,
  );
  return (
    <>
      <button
        className="floating-chat"
        type="button"
        aria-haspopup="dialog"
        aria-controls="quick-chat"
        aria-label="Открыть окно чатов"
        onClick={() => open("quick-chat")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
          <path
            d="M4 4h16v12H9l-5 4V4ZM8 8h8M8 12h5"
            stroke="currentColor"
            strokeWidth="1.7"
          />
        </svg>
        <span>Чат</span>
        {signedIn && unread > 0 && (
          <span className="chat-badge" aria-label={"Непрочитанных: " + unread}>
            {unread}
          </span>
        )}
      </button>
      <Dialog id="quick-chat" title="Чаты" className="quick-chat">
        {signedIn ? (
          <>
            <PollError error={error} />
            {threads.length ? (
              <ConversationList
                onSelect={close}
                threads={threads}
                href={(t) => "/chat?thread=" + threadKey(t)}
              />
            ) : (
              <p className="quick-chat-empty">Пока нет диалогов.</p>
            )}
            <a href="/chat" className="btn btn-primary">
              Все чаты
            </a>
          </>
        ) : (
          <>
            <p className="quick-chat-empty">
              {sessionError?.status === 401
                ? "Сессия закончилась. Войди снова."
                : "Чат доступен после входа"}
            </p>
            <a href="/chat?thread=direct&login=1" className="btn btn-primary">
              Войти
            </a>
          </>
        )}
      </Dialog>
    </>
  );
}
