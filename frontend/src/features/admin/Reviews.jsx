import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Dialog, ErrorHint, useUI } from "../../components/UI";

const statuses = {
  pending: "На модерации",
  published: "Опубликован",
  rejected: "Отклонён",
};

export default function AdminReviews() {
  const { open, close, toast } = useUI();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    api("/admin/reviews?page=" + page)
      .then((data) => {
        if (active) {
          setResult(data);
          setError(null);
        }
      })
      .catch((error) => {
        if (active) setError(error);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);

  async function moderate(review, status) {
    setBusy(true);
    setError(null);
    try {
      await api(
        "/admin/reviews/" + review.id + "/status",
        { status },
        { method: "PUT" },
      );
      setRevision((n) => n + 1);
      toast(status === "published" ? "Отзыв опубликован" : "Отзыв отклонён");
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("/admin/reviews/" + selected.id, {}, { method: "DELETE" });
      close();
      toast("Отзыв удалён");
      if (result.items.length === 1 && page > 1) setPage(page - 1);
      else setRevision((n) => n + 1);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="pagehd">
        <h1>Отзывы</h1>
      </section>
      <ErrorHint error={error} />
      {!result && !error && <p role="status">Загружаем отзывы…</p>}
      {result?.items.length === 0 && (
        <p className="portfolio-empty">Отзывов пока нет.</p>
      )}
      <div className="review-list">
        {result?.items.map((review) => (
          <article key={review.id}>
            <h2 className="h2">{review.author_name}</h2>
            <span className="up">
              {review.rating} / 5 · {statuses[review.status]}
            </span>
            <p className="hint">
              {new Date(review.created_at).toLocaleDateString("ru-RU")} ·{" "}
              {review.service}
            </p>
            <p className="user-text">{review.body}</p>
            <div className="cta">
              {review.status !== "published" && (
                <button
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => moderate(review, "published")}
                >
                  Опубликовать
                </button>
              )}
              {review.status !== "rejected" && (
                <button
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={() => moderate(review, "rejected")}
                >
                  Отклонить
                </button>
              )}
              <button
                className="btn btn-sm"
                onClick={() => {
                  setError(null);
                  setSelected(review);
                  open("admin-delete-review");
                }}
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>
      {result?.pages > 1 && (
        <nav className="cta admin-pagination" aria-label="Страницы отзывов">
          <button
            className="btn btn-sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </button>
          <span>
            {page} / {result.pages}
          </span>
          <button
            className="btn btn-sm"
            disabled={page >= result.pages}
            onClick={() => setPage(page + 1)}
          >
            Вперёд
          </button>
        </nav>
      )}
      <Dialog id="admin-delete-review" title="Удалить отзыв?">
        <p>
          Отзыв автора «{selected?.author_name}» будет удалён без возможности
          восстановления.
        </p>
        <ErrorHint error={error} />
        <div className="cta">
          <button className="btn btn-primary" disabled={busy} onClick={remove}>
            Удалить отзыв
          </button>
          <button className="btn" disabled={busy} onClick={close}>
            Отмена
          </button>
        </div>
      </Dialog>
    </>
  );
}
