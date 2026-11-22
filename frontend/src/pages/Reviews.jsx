import { useEffect, useState } from "react";
import { useAuth } from "../features/AuthContext";
import { api } from "../lib/api";
import { ErrorHint, useUI } from "../components/UI";

const statuses = {
  pending: "На модерации",
  published: "Опубликован",
  rejected: "Отклонён",
};
const ratings = [5, 4, 3, 2, 1];
function Stars({ rating, average = false }) {
  return (
    <div className="review-stars" role="img" aria-label={rating + " из 5"}>
      {[1, 2, 3, 4, 5].map((value) => {
        const fill = Math.max(0, Math.min(1, rating - value + 1));
        return (
          <span
            key={value}
            className={fill === 0 ? "empty-star" : undefined}
            style={
              average && fill > 0 && fill < 1
                ? { clipPath: "inset(0 " + (1 - fill) * 100 + "% 0 0)" }
                : undefined
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
            </svg>
          </span>
        );
      })}
    </div>
  );
}

export default function Reviews() {
  const { user } = useAuth();
  const userId = user?.id;
  const [personal, setPersonal] = useState(null);
  const [revision, setRevision] = useState(0);
  const mine = userId && personal?.userId === userId ? personal.rows : [];
  useEffect(() => {
    if (!userId) return;
    let active = true;
    api("/reviews/mine")
      .then((rows) => {
        if (active) setPersonal({ userId, rows });
      })
      .catch((error) => {
        if (active) setPersonal({ userId, rows: [], error });
      });
    return () => {
      active = false;
    };
  }, [userId, revision]);
  const [sort, setSort] = useState("new");
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let active = true;
    api("/reviews")
      .then((rows) => {
        if (active) setReviews(rows);
      })
      .catch((error) => {
        if (active) setError(error);
      });
    return () => {
      active = false;
    };
  }, []);
  const [services, setServices] = useState(null);
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast, close } = useUI();

  async function loadServices() {
    if (services) return;
    setFormError(null);
    try {
      setServices(await api("/services"));
    } catch (error) {
      setFormError(error);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true);
    setFormError(null);
    try {
      await api("/reviews", { ...fields, rating: Number(fields.rating) });
      if (userId) setRevision((value) => value + 1);
      form.reset();
      form.closest("dialog").close();
      close();
      toast("Отзыв отправлен на модерацию");
    } catch (error) {
      setFormError(error);
    } finally {
      setBusy(false);
    }
  }

  const count = reviews?.length ?? 0;
  const average = count
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / count
    : 0;
  const ordered = [...(reviews ?? [])].sort((a, b) => {
    if (sort === "low") return a.rating - b.rating;
    if (sort === "high") return b.rating - a.rating;
    if (sort === "old")
      return Date.parse(a.created_at) - Date.parse(b.created_at);
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
  const ownIds = new Set(mine.map((review) => review.id));
  const displayed = [
    ...mine,
    ...ordered.filter((review) => !ownIds.has(review.id)),
  ];
  return (
    <>
      <section className="pagehd">
        <h1>Отзывы</h1>
      </section>
      <div className="reviews-layout">
        <aside className="reviews-sidebar" aria-label="Сводка и сортировка">
          <section className="reviews-summary" aria-label="Рейтинг">
            <dl>
              <div>
                <dt>Средняя оценка</dt>
                <dd>
                  {count
                    ? average.toLocaleString("ru-RU", {
                        maximumFractionDigits: 1,
                      })
                    : "—"}
                </dd>
                {count > 0 && (
                  <Stars rating={Number(average.toFixed(1))} average />
                )}
              </div>
              <div>
                <dt>Всего отзывов</dt>
                <dd>{reviews ? count : "—"}</dd>
              </div>
            </dl>
          </section>
          <div className="rating-bars" aria-label="Распределение оценок">
            {ratings.map((rating) => (
              <div key={rating}>
                <span>{rating}</span>
                <meter
                  min={0}
                  max={Math.max(count, 1)}
                  value={
                    reviews?.filter((r) => r.rating === rating).length ?? 0
                  }
                  aria-label={"Оценка " + rating}
                />
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            type="button"
            data-open="review-form"
            onClick={loadServices}
            aria-haspopup="dialog"
          >
            Оставить отзыв
          </button>
          <label className="review-sort">
            Сортировать
            <select
              id="review-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="new">Сначала новые</option>
              <option value="old">Сначала старые</option>
              <option value="high">Высокая оценка</option>
              <option value="low">Низкая оценка</option>
            </select>
          </label>
        </aside>
        <section className="review-list" aria-label="Отзывы клиентов">
          <ErrorHint error={error} />
          {!reviews && !error && <p role="status">Загружаем отзывы…</p>}
          {userId && personal?.userId === userId && (
            <ErrorHint error={personal.error} />
          )}
          {reviews &&
            displayed.length === 0 &&
            (!userId || personal?.userId === userId) && (
              <p className="portfolio-empty">Отзывов пока нет.</p>
            )}
          {displayed.map((review) => (
            <article key={review.id} data-rating={review.rating}>
              <h2>{review.author_name}</h2>
              <time dateTime={review.created_at}>
                {new Date(review.created_at).toLocaleDateString("ru-RU")}
              </time>
              <Stars rating={review.rating} />
              {ownIds.has(review.id) && (
                <p className="up">
                  <span className="request-status">Ваш отзыв</span> ·{" "}
                  {statuses[review.status]}
                </p>
              )}
              <p className="up">{review.service}</p>
              <p className="user-text">{review.body}</p>
            </article>
          ))}
        </section>
      </div>
      <dialog className="dlg" id="review-form" aria-labelledby="review-title">
        <button
          className="dlg-x"
          type="button"
          data-close=""
          aria-label="Закрыть"
        >
          ×
        </button>
        <div className="dlg-in">
          <h2 id="review-title">Оставить отзыв</h2>
          <form onSubmit={submit}>
            <label className="fl">
              <span>Имя</span>
              <input
                type="text"
                name="author_name"
                maxLength={120}
                required
                autoComplete="name"
              />
            </label>
            <label className="fl">
              <span>Оценка</span>
              <select name="rating">
                <option>5</option>
                <option>4</option>
                <option>3</option>
                <option>2</option>
                <option>1</option>
              </select>
            </label>
            <label className="fl">
              <span>Услуга</span>
              <select name="service_code" required defaultValue="">
                <option value="" disabled>
                  {services ? "Услуга не выбрана" : "Загрузка услуг…"}
                </option>
                {services?.map((service) => (
                  <option key={service.code} value={service.code}>
                    {service.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="fl">
              <span>Отзыв</span>
              <textarea name="body" rows="4" required maxLength={2000} />
            </label>
            <ErrorHint error={formError} />
            {!services && formError && (
              <button className="btn" type="button" onClick={loadServices}>
                Повторить загрузку услуг
              </button>
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || !services?.length}
            >
              {busy ? "Отправляем…" : "Отправить отзыв"}
            </button>
            <p className="hint">Отзыв появится на сайте после проверки.</p>
          </form>
        </div>
      </dialog>
    </>
  );
}
