import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAdmin } from "../features/AdminContext";
import { Dialog, ErrorHint, useUI } from "../components/UI";
export default function Portfolio() {
  const { admin, preview } = useAdmin(),
    { open } = useUI(),
    [rows, setRows] = useState(null),
    [error, setError] = useState(null),
    [detail, setDetail] = useState(null);
  useEffect(() => {
    let live = true;
    api("/portfolio" + (admin && preview ? "?preview=1" : ""))
      .then((r) => {
        if (live) setRows(r);
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, [admin, preview]);
  const types = {
    site: "Сайт",
    app: "Android-приложение",
    small: "Мини-проект",
    study: "Учёба",
  };
  return (
    <>
      <section className="pagehd">
        <h1>Портфолио</h1>
      </section>
      <ErrorHint error={error} />
      {!rows && !error && <p role="status">Загружаем работы…</p>}
      {rows?.length === 0 && (
        <section className="portfolio-empty">
          <p>Работы скоро появятся.</p>
        </section>
      )}
      <section className="project-previews" aria-label="Проекты">
        {rows?.map((p) => (
          <article key={p.id}>
            <button
              className="project-preview"
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                setDetail(p);
                open("portfolio-detail");
              }}
            >
              {p.cover && <img src={p.cover.thumb_url} alt={p.cover.alt} />}
              <strong>{p.title || "Без названия"}</strong>
              <span>{types[p.kind]}</span>
              {p.status === "draft" && <span className="up">Черновик</span>}
            </button>
          </article>
        ))}
      </section>
      <Dialog
        id="portfolio-detail"
        title={detail?.title || "Проект"}
        className="project-detail"
      >
        {detail && (
          <>
            <p className="user-text">{detail.description}</p>
            <div className="detail-images">
              {detail.images.map((i) => (
                <img key={i.media_id} src={i.url} alt={i.alt} />
              ))}
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
