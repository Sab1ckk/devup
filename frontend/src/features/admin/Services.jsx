import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { ErrorHint, Field, useUI } from "../../components/UI";
function ServiceCard({ service }) {
  const [data, setData] = useState({
      ...service,
      features: service.features.join("\n"),
      price_from: service.price_from ?? "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    { toast } = useUI();
  const change = (e) => setData({ ...data, [e.target.name.replace(service.code+"-","")]: e.target.value });
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(
        "/admin/services/" + service.code,
        {
          title: data.title,
          description: data.description,
          features: data.features
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          price_from: data.price_from === "" ? null : Number(data.price_from),
        },
        { method: "PUT" },
      );
      toast("Услуга сохранена");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  const fieldError = (name) =>
    (error?.field === name ||
      error?.errors?.some((e) => e.field.startsWith(name))) && (
      <ErrorHint error="Значение или длина поля указаны неверно." />
    );
  return (
    <article className="card admin-service">
      <h2 className="h2">{service.title}</h2>
      <form className="form" onSubmit={save}>
        <Field
          label="Название"
          name={service.code+"-title"}
          required
          maxLength={100}
          value={data.title}
          onChange={change}
        />
        {fieldError("title")}
        <label className="fl">
          <span>Описание</span>
          <textarea
            name="description"
            maxLength={500}
            value={data.description}
            onChange={change}
          />
          {fieldError("description")}
        </label>
        <label className="fl">
          <span>Пункты · один на строку</span>
          <textarea name="features" value={data.features} onChange={change} />
          <small className="hint">До 6 пунктов по 100 символов.</small>
          {fieldError("features")}
        </label>
        <Field
          label="Цена от · ₽"
          name={service.code+"-price_from"}
          type="number"
          min={0}
          max={10000000}
          step={1}
          value={data.price_from}
          onChange={change}
          hint="При пустом значении будет отображено «по запросу»."
        />
        {fieldError("price_from")}
        <ErrorHint error={error} />
        <div className="cta">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Выполняется сохранение…" : "Сохранить"}
          </button>
          <a
            className="btn btn-sm"
            href="/services"
            target="_blank"
            rel="noreferrer"
          >
            Посмотреть на сайте
          </a>
        </div>
      </form>
    </article>
  );
}
export default function Services() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(null);
  useEffect(() => {
    api("/admin/services").then(setRows).catch(setError);
  }, []);
  return (
    <>
      <section className="pagehd">
        <h1>Услуги</h1>
        <p>Тексты и ориентировочные цены доступны для редактирования.</p>
      </section>
      <ErrorHint error={error} />
      {!rows && !error && <p role="status">Загружаем услуги…</p>}
      <section className="admin-grid admin-services-grid">
        {rows?.map((s) => (
          <ServiceCard key={s.code} service={s} />
        ))}
      </section>
    </>
  );
}
