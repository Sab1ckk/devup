import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAdmin } from "../features/AdminContext";
import { Dialog, ErrorHint, useUI } from "../components/UI";
export default function Portfolio() {
  const { admin, preview } = useAdmin(),
    { open } = useUI(),
    [rows, setRows] = useState(null),
    [error, setError] = useState(null),
    [detail, setDetail] = useState(null),
    [fullImage, setFullImage] = useState(null);
  const imageDialogRef = useRef(null);
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

  useEffect(() => {
    const dialog = imageDialogRef.current;
    if (!fullImage || !dialog) return;

    if (!dialog.open) dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [fullImage]);

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
                <button
                  key={i.media_id}
                  type="button"
                  className="detail-image-button"
                  aria-label={`Открыть изображение: ${i.alt || detail.title || "изображение"}`}
                  onClick={() => setFullImage(i)}
                  style={{
                    display: "block",
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    cursor: "zoom-in",
                  }}
                >
                  <img src={i.url} alt={i.alt} />
                </button>
              ))}
            </div>
          </>
        )}
      </Dialog>

      {fullImage && (
        <dialog
          ref={imageDialogRef}
          className="portfolio-image-viewer"
          aria-label="Полноэкранный просмотр изображения"
          onClose={() => setFullImage(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setFullImage(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            maxWidth: "100vw",
            maxHeight: "100vh",
            margin: 0,
            padding: "24px",
            boxSizing: "border-box",
            border: 0,
            background: "rgba(0, 0, 0, 0.92)",
            color: "#fff",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
          <button
            type="button"
            className="portfolio-image-viewer-close"
            aria-label="Закрыть полноэкранный просмотр"
            onClick={() => setFullImage(null)}
            style={{
              position: "absolute",
              top: "16px",
              right: "20px",
              zIndex: 1,
              width: "44px",
              height: "44px",
              border: 0,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.14)",
              color: "#fff",
              fontSize: "30px",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>

          <img
            src={fullImage.url}
            alt={fullImage.alt || detail?.title || "Изображение проекта"}
            onClick={(event) => event.stopPropagation()}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              cursor: "default",
            }}
          />
          </div>
        </dialog>
      )}
    </>
  );
}
