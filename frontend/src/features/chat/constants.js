export const intervals = {
  messages: 5000,
  hidden: 30000,
  client: 30000,
  manager: 15000,
  maxRetry: 60000,
};
export const CHAT_CHANGED = "devup-chat-changed";
export const threadKey = (thread) =>
  thread.kind === "direct" ? "direct" : "devup-" + thread.request_number;
export const threadTitle = (thread) =>
  thread.kind === "direct"
    ? "Связь с менеджером"
    : "Заявка DEVUP-" + thread.request_number;
