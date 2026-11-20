import { useAuth } from '../features/AuthContext';
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { ErrorHint, Field, useUI } from "../components/UI";
import Builder from "../features/Builder";
import useDraft from "../hooks/useDraft";
import useMailStatus from "../hooks/useMailStatus";

function SuccessScreen({ result }) {
  const { toast, open } = useUI(),
    [saved, setSaved] = useState(false),
    receipt = useMailStatus(result.mail_id);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${result.display_number}\n${result.claim_code}`,
      );
      toast("Номер и код скопированы");
    } catch {
      toast("Не удалось скопировать. Выдели номер и код вручную.");
    }
  }
  return (
    <section className="sec order-success">
      <div className="pagehd">
        <h1>Заявка принята.</h1>
      </div>
      <div className="claim-print">
        <p className="up">Номер заявки</p>
        <h2 className="code">{result.display_number}</h2>
        {result.claim_code ? (
          <>
            <p className="up">Код привязки</p>
            <p className="claim-secret code">{result.claim_code}</p>
            <p>Сохрани этот код. Показываем его один раз.</p>
          </>
        ) : (
          <p>Заявка привязана к твоему кабинету.</p>
        )}
      </div>
      {result.email && (
        <p role="status">
          {receipt?.status === "sent"
            ? `Копия отправлена на ${result.email}`
            : receipt?.status === "failed"
              ? "Письмо не отправлено. Сохрани номер и код с этого экрана."
              : "Проверяем отправку письма…"}
        </p>
      )}
      {result.claim_code ? (
        <>
          <div className="cta">
            <button className="btn" onClick={copy}>
              Скопировать
            </button>
            <button className="btn" onClick={() => window.print()}>
              Сохранить в PDF
            </button>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
            />
            <span>Я сохранил код</span>
          </label>
          <button
            className="btn btn-primary"
            disabled={!saved}
            onClick={() => open("auth")}
          >
            Зарегистрироваться / Войти
          </button>
        </>
      ) : (
        <Link className="btn btn-primary" to="/cabinet">
          Открыть в кабинете
        </Link>
      )}
    </section>
  );
}
export default function Order() {
  const {user}=useAuth();
  const [result, setResult] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [website, setWebsite] = useState("");
  const lock = useRef(false),
    { toast } = useUI(),
    { draft, setDraft, restored, clear } = useDraft(Boolean(result));
  useEffect(() => {
    if (restored) toast("Черновик восстановлен");
  }, [restored, toast]);
  const change = (e) =>
    setDraft((d) => ({ ...d, [e.target.name]: e.target.value }));
  function fieldError(name) {
    return error?.field === name ||
      error?.errors?.some((e) => e.field === name) ? (
      <ErrorHint error="Проверь это поле." />
    ) : null;
  }
  async function submit(e) {
    e.preventDefault();
    if (lock.current) return;
    const contacts = ["email", "telegram", "vk"]
      .filter((kind) => draft[kind]?.trim())
      .map((kind) => ({ kind, value: draft[kind].trim() }));
    if (!contacts.length && !user) {
      setError({ message: "Оставь хотя бы один контакт.", field: "contacts" });
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        project_type: draft.project_type,
        contacts,
        blocks: draft.blocks.map(({ kind, title, description }) => ({
          kind,
          title,
          description,
        })),
        website,
      };
      for (const key of [
        "company_text",
        "wishes_text",
        "design_text",
        "deadline_text",
        "budget_text",
      ])
        payload[key] = draft[key];
      const response = await api("/requests", payload);
      setResult(response);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err);
      document
        .querySelector('[role="alert"]')
        ?.scrollIntoView({ block: "center" });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (result) return <SuccessScreen result={result} />;
  return (
    <>
      <section className="pagehd">
        <h1>
          Твой проект.
          <br />
          <span className="hl">По блокам.</span>
        </h1>
        <p>
          Добавляй нужное, меняй порядок, оставляй заметки. Соберём картину
          будущего проекта.
        </p>
      </section>
      {restored && (
        <div className="sec-top">
          <p className="hint">Черновик восстановлен</p>
          <button type="button" className="btn btn-sm" onClick={clear}>
            Очистить
          </button>
        </div>
      )}
      <form onSubmit={submit} id="order-form">
        <fieldset disabled={busy} className="order-fieldset">
          <section className="project-intro">
            <p className="order-help">
              <Link className="btn" to="/chat?thread=direct&login=1">
                Связаться с менеджером
              </Link>
            </p>
            <div className="form">
              {[
                [
                  "company_text",
                  "О компании и задаче",
                  "Чем занимаетесь и что хотите получить?",
                ],
                [
                  "wishes_text",
                  "Слоганы и пожелания",
                  "Фразы, характер, настроение",
                ],
              ].map(([name, label, placeholder]) => (
                <label className="fl" key={name}>
                  <span>{label}</span>
                  <textarea
                    id={name}
                    name={name}
                    placeholder={placeholder}
                    maxLength={4000}
                    value={draft[name]}
                    onChange={change}
                  />
                  {fieldError(name)}
                </label>
              ))}
            </div>
          </section>
          <Builder draft={draft} setDraft={setDraft} disabled={busy} />
          <section className="brief-section">
            <div>
              <h2 className="h2">
                Дизайн
                <br />и детали.
              </h2>
            </div>
            <div className="form brief-form">
              <label className="fl">
                <span>Дизайн и примеры</span>
                <textarea
                  name="design_text"
                  id="design_text"
                  maxLength={4000}
                  placeholder="Ссылки на референсы и описание материалов"
                  value={draft.design_text}
                  onChange={change}
                />
                {fieldError("design_text")}
              </label>
              <div className="attachment-mock">
                <span>
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 18 18 6M6 6h12v12" />
                  </svg>{" "}
                  Макеты, фото и документы
                </span>
                <small>Область прикрепления файлов · макет</small>
              </div>
              <div className="row2">
                <Field
                  label="Сроки"
                  name="deadline_text"
                  maxLength={4000}
                  placeholder="До даты или диапазон"
                  value={draft.deadline_text}
                  onChange={change}
                />
                <Field
                  label="Бюджет"
                  name="budget_text"
                  maxLength={4000}
                  placeholder="Обсудим с менеджером"
                  value={draft.budget_text}
                  onChange={change}
                />
              </div>
              <Field
                label="Почта (рекомендуем)"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={320}
                value={draft.email}
                onChange={change}
                hint="Рекомендуем указать почту: на неё придёт номер заявки и код привязки, так их не потеряешь. Без почты код будет только на экране."
              />
              <Field
                label="Telegram"
                name="telegram"
                maxLength={320}
                placeholder="@username или ссылка"
                value={draft.telegram}
                onChange={change}
                hint="Нужен менеджеру, чтобы связаться. Заявку к аккаунту по нему не привяжем."
              />
              <Field
                label="ВКонтакте"
                name="vk"
                maxLength={320}
                placeholder="Имя или ссылка на профиль"
                value={draft.vk}
                onChange={change}
                hint="Нужен менеджеру, чтобы связаться. Заявку к аккаунту по нему не привяжем."
              />
              <label className="honeypot" aria-hidden="true">
                Сайт
                <input
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
              <ErrorHint error={error} />
              {user && <p className="hint">Оставь все контакты пустыми, чтобы использовать сохранённые контакты и почту аккаунта.</p>}
            <div className="brief-end">
                <p>
                  Всё начинается
                  <br />с твоей идеи.
                </p>
                <button
                  className="btn btn-primary"
                  type="submit"
                  data-magnet=""
                  disabled={busy}
                >
                  {busy ? "Отправляем…" : "Оставить заявку"}{" "}
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 18 18 6M6 6h12v12" />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        </fieldset>
      </form>
    </>
  );
}
