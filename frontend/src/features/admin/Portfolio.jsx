import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { Dialog, ErrorHint, Field, useUI } from "../../components/UI";
const types = {
  site: "Сайт",
  app: "Android",
  small: "Мини-проект",
  study: "Учёба",
};
function Arrow({ down = false }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={down ? "m6 10 6 6 6-6M12 4v12" : "m6 14 6-6 6 6M12 8v12"} />
    </svg>
  );
}
export function PortfolioList() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/admin/portfolio").then(setRows).catch(setError);
  }, []);
  async function move(index, delta) {
    const result = [...rows],
      [item] = result.splice(index, 1);
    result.splice(index + delta, 0, item);
    setBusy(true);
    setError(null);
    try {
      await api(
        "/admin/portfolio/order",
        { ids: result.map((p) => p.id) },
        { method: "PUT" },
      );
      setRows(result);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="pagehd">
        <h1>Портфолио</h1>
      </section>
      <div className="sec-top">
        <h2 className="h2">Работы</h2>
        <Link className="btn btn-primary" to="/admin/portfolio/new">
          Добавить работу
        </Link>
      </div>
      <ErrorHint error={error} />
      {!rows && !error && <p role="status">Загружаем работы…</p>}
      {rows?.length === 0 && (
        <p className="portfolio-empty">Работы пока не добавлены.</p>
      )}
      <section className="admin-grid">
        {rows?.map((p, index) => (
          <article className="card" key={p.id}>
            {p.cover && (
              <img
                className="admin-thumb"
                src={p.cover.thumb_url}
                alt={p.cover.alt}
              />
            )}
            <h2 className="h2">{p.title || "Без названия"}</h2>
            <p className="up">
              {types[p.kind]} ·{" "}
              {p.status === "published" ? "Опубликовано" : "Черновик"}
            </p>
            <div className="block-actions">
              <button
                type="button"
                aria-label={"Переместить выше " + p.title}
                disabled={busy || index === 0}
                onClick={() => move(index, -1)}
              >
                <Arrow />
              </button>
              <button
                type="button"
                aria-label={"Переместить ниже " + p.title}
                disabled={busy || index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                <Arrow down />
              </button>
            </div>
            <Link className="btn btn-sm" to={"/admin/portfolio/" + p.id}>
              Править
            </Link>
          </article>
        ))}
      </section>
    </>
  );
}
const empty = {
  title: "",
  kind: "site",
  description: "",
  status: "draft",
  images: [],
};
function Editor({ initial, id }) {
  const [data, setData] = useState(initial),
    [baseline, setBaseline] = useState(JSON.stringify(initial)),
    [error, setError] = useState(null),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [uploadErrors, setUploadErrors] = useState([]);
  const fileInput = useRef(null),
    uploadLock = useRef(false),
    bypass = useRef(false),
    navigate = useNavigate(),
    { open, close, toast } = useUI();
  const dirty = JSON.stringify(data) !== baseline,
    blocker = useBlocker(() => dirty && !bypass.current);
  useEffect(() => {
    if (blocker.state === "blocked") open("admin-unsaved");
  }, [blocker.state, open]);
  useEffect(() => {
    const leave = (e) => {
      if (dirty && !bypass.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  const change = (e) => setData({ ...data, [e.target.name]: e.target.value });
  async function upload(files) {
    if (uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setUploadErrors([]);
    const errors = [];
    let count = data.images.length;
    for (const file of [...files]) {
      if (count >= 12) {
        errors.push(`${file.name}: максимум 12 картинок`);
        continue;
      }
      try {
        const form = new FormData();
        form.append("file", file);
        const media = await api("/admin/media", form);
        setData((d) => ({
          ...d,
          images: [...d.images, { ...media, alt_text: "", is_cover: false }],
        }));
        count++;
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }
    setUploadErrors(errors);
    setUploading(false);
    uploadLock.current = false;
    if (fileInput.current) fileInput.current.value = "";
  }
  function moveImage(index, delta) {
    const images = [...data.images],
      [item] = images.splice(index, 1);
    images.splice(index + delta, 0, item);
    setData({ ...data, images });
  }
  async function save(status) {
    if (busy || uploading) return;
    if(status==='published'&&(!data.title.trim()||!data.images.length)){setError(new Error('Для публикации должны быть добавлены название и хотя бы одна картинка.'));return;}
    setBusy(true);
    setError(null);
    const payload = {
      title: data.title,
      description: data.description,
      kind: data.kind,
      status,
      images: data.images.map(({ media_id, alt_text, is_cover }) => ({
        media_id,
        alt_text,
        is_cover,
      })),
    };
    try {
      const r = await api("/admin/portfolio" + (id ? "/" + id : ""), payload, {
        method: id ? "PUT" : "POST",
      });
      bypass.current = true;
      setData(r);
      setBaseline(JSON.stringify(r));
      toast(
        status === "published" ? "Работа опубликована" : "Черновик сохранён",
      );
      if (!id) navigate("/admin/portfolio/" + r.id, { replace: true });
      requestAnimationFrame(() => {
        bypass.current = false;
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("/admin/portfolio/" + id, {}, { method: "DELETE" });
      bypass.current = true;
      close();
      navigate("/admin/portfolio");
      toast("Работа удалена");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const fieldError = (name) =>
    (error?.field === name ||
      error?.errors?.some((e) => e.field.startsWith(name))) && (
      <ErrorHint error="Поле заполнено неверно." />
    );
  return (
    <>
      <section className="pagehd">
        <h1>{id ? "Править работу" : "Новая работа"}</h1>
        <p className="up">
          {data.status === "published" ? "Опубликовано" : "Черновик"}
        </p>
      </section>
      <section className="sec form">
        <Field
          label="Название"
          name="title"
          maxLength={100}
          value={data.title}
          onChange={change}
        />
        {fieldError("title")}
        <label className="fl">
          <span>Тип проекта</span>
          <select name="kind" value={data.kind} onChange={change}>
            {Object.entries(types).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="fl">
          <span>Описание</span>
          <textarea
            name="description"
            maxLength={1000}
            value={data.description}
            onChange={change}
          />
          {fieldError("description")}
        </label>
        <h2 className="h2">Картинки</h2>
        <div
          className="drop-target admin-upload"
          role="button"
          tabIndex={0}
          aria-label="Загрузить картинки"
          onClick={() => {
            if (!uploading) fileInput.current.click();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!uploading) fileInput.current.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            upload(e.dataTransfer.files);
          }}
        >
          <span>
            {uploading
              ? "Загружаем…"
              : "Изображения могут быть перенесены сюда или выбраны нажатием"}
          </span>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => upload(e.target.files)}
          />
        </div>
        <p className="hint">
          Лучше загружать изображения с пропорциями 8:5, например 1600 × 1000.
          PNG, JPEG, WebP — до 5 МБ.
        </p>
        {uploadErrors.map((message, i) => (
          <ErrorHint key={i} error={message} />
        ))}
        <div className="admin-grid">
          {data.images.map((image, index) => (
            <article className="card" key={image.media_id}>
              <img
                className="admin-thumb"
                src={image.thumb_url}
                alt={image.alt_text}
              />
              <Field
                label="Подпись картинки"
                name={"alt-" + image.media_id}
                maxLength={200}
                value={image.alt_text}
                onChange={(e) =>
                  setData({
                    ...data,
                    images: data.images.map((x, i) =>
                      i === index ? { ...x, alt_text: e.target.value } : x,
                    ),
                  })
                }
              />
              <div className="block-actions">
                <button
                  type="button"
                  aria-label={"Картинка " + (index + 1) + " выше"}
                  disabled={index === 0}
                  onClick={() => moveImage(index, -1)}
                >
                  <Arrow />
                </button>
                <button
                  type="button"
                  aria-label={"Картинка " + (index + 1) + " ниже"}
                  disabled={index === data.images.length - 1}
                  onClick={() => moveImage(index, 1)}
                >
                  <Arrow down />
                </button>
              </div>
              <button
                className="btn btn-sm"
                type="button"
                aria-pressed={image.is_cover}
                onClick={() =>
                  setData({
                    ...data,
                    images: data.images.map((x, i) => ({
                      ...x,
                      is_cover: i === index,
                    })),
                  })
                }
              >
                {image.is_cover ? "Обложка" : "Сделать обложкой"}
              </button>
              <button
                className="btn btn-sm"
                type="button"
                onClick={() =>
                  setData({
                    ...data,
                    images: data.images.filter((_, i) => i !== index),
                  })
                }
              >
                Удалить картинку
              </button>
            </article>
          ))}
        </div>
        <ErrorHint error={error} />
        <div className="cta">
          <button
            className="btn"
            disabled={busy || uploading}
            onClick={() => save("draft")}
          >
            {data.status === "published"
              ? "Снять с публикации"
              : "Сохранить черновик"}
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || uploading}
            onClick={() => save("published")}
          >
            Опубликовать
          </button>
          {id && (
            <button
              className="btn"
              disabled={busy || uploading}
              onClick={() => open("admin-delete-project")}
            >
              Удалить
            </button>
          )}
        </div>
      </section>
      <Dialog id="admin-delete-project" title="Удалить работу?">
        <p>Работа и её картинки будут удалены.</p>
        <ErrorHint error={error} />
        <div className="cta">
          <button className="btn btn-primary" disabled={busy} onClick={remove}>
            Удалить работу
          </button>
          <button className="btn" onClick={close}>
            Отмена
          </button>
        </div>
      </Dialog>
      <Dialog id="admin-unsaved" title="Есть несохранённые изменения">
        <p>Уйти со страницы и потерять изменения?</p>
        <div className="cta">
          <button
            className="btn"
            onClick={() => {
              blocker.reset();
              close();
            }}
          >
            Остаться
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              bypass.current = true;
              blocker.proceed();
              close();
            }}
          >
            Уйти без сохранения
          </button>
        </div>
      </Dialog>
    </>
  );
}
export function PortfolioEditor() {
  const { id } = useParams(),
    [loaded, setLoaded] = useState(null),
    [error, setError] = useState(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    api("/admin/portfolio/" + id)
      .then((r) => {
        if (active) setLoaded(r);
      })
      .catch((e) => {
        if (active) setError(e);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (!id) return <Editor key="new" initial={empty} />;
  return (
    <>
      <ErrorHint error={error} />
      {loaded?.id === id ? (
        <Editor key={id} initial={loaded} id={id} />
      ) : (
        !error && <p role="status">Загружаем работу…</p>
      )}
    </>
  );
}
