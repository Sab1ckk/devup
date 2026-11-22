import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ErrorHint } from "../components/UI";
export default function Services() {
  const [rows, setRows] = useState(null),
    [error, setError] = useState(null);
  useEffect(() => {
    let live = true;
    api("/services")
      .then((r) => {
        if (live) setRows(r);
      })
      .catch((e) => {
        if (live) setError(e);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      <section className="pagehd">
        <h1 className="rv">
          Что
          <br />
          делаем
        </h1>
        <p className="rv">
          Цены ориентировочные: точную называет менеджер после уточнения
          деталей.
        </p>
      </section>
      <section className="sec" style={{ paddingTop: "var(--space-5)" }}>
        <ErrorHint error={error} />
        {!rows && !error && <p role="status">Загружаем услуги…</p>}
        <div className="svcgrid">
          {rows?.map((service) => (
            <a
              key={service.code}
              className="svc rv"
              data-service={service.code}
              href={"/order?type=" + service.code}
            >
              <div className="service-visual">
                <span className="code">
                  {
                    { site: "WEB", app: "APK", small: "MINI", study: "EDU" }[
                      service.code
                    ]
                  }
                </span>
                <img
                  className="service-art"
                  src={"/assets/service-" + service.code + ".svg"}
                  width="300"
                  height="190"
                  alt=""
                />
              </div>
              <div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                {service.features.length > 0 && (
                  <ul>
                    {service.features.map((text, i) => (
                      <li key={i}>{text}</li>
                    ))}
                  </ul>
                )}
                <span className="price">
                  {service.price_from === null
                    ? "по запросу"
                    : "от " +
                      new Intl.NumberFormat("ru-RU").format(
                        service.price_from,
                      ) +
                      " ₽"}
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
      <section className="sec" id="process">
        <div className="sec-top rv">
          <h2 className="h2">Порядок заявки</h2>
        </div>
        <ol className="process-timeline">
          <li className="timeline-step">
            <span className="up">Шаг 1</span>
            <h3>Заполняется форма</h3>
            <p>
              В форме описываются страницы и функции, указываются сроки, бюджет и контакты. Вопросы могут быть заданы менеджеру после регистрации.
            </p>
          </li>
          <li className="timeline-step">
            <span className="up">Шаг 2</span>
            <h3>Присваивается номер</h3>
            <p>
              Номер заявки, примерная стоимость, ссылки на менеджера в Telegram
              и ВКонтакте.
            </p>
          </li>
          <li className="timeline-step">
            <span className="up">Шаг 3</span>
            <h3>Согласуем</h3>
            <p>Менеджер называет точную цену и фиксирует сроки.</p>
          </li>
          <li className="timeline-step">
            <span className="up">Шаг 4</span>
            <h3>Делаем и сдаём</h3>
            <p>
              У каждой заявки свой чат. Прошлые заявки привязываются к кабинету
              по номеру.
            </p>
          </li>
        </ol>
      </section>
      <section className="sec">
        <div className="sec-top rv">
          <h2 className="h2">Вопросы</h2>
        </div>
        <div className="faq">
          <details className="rv">
            <summary>Нужна ли регистрация, чтобы оставить заявку?</summary>
            <p>
              Нет. Заявку можно отправить без входа. Вы получите номер, по
              которому её потом можно привязать к личному кабинету.
            </p>
          </details>
          <details className="rv">
            <summary>Как считается примерная стоимость?</summary>
            <p>
              По типу работы, числу страниц и количеству особых функций. Это
              ориентир. Точную цену называет менеджер после уточнения деталей.
            </p>
          </details>
          <details className="rv">
            <summary>Что, если мой бюджет меньше расчёта?</summary>
            <p>
              Задача может быть обсуждена с менеджером, упрощена или разделена на
              этапы.
            </p>
          </details>
          <details className="rv">
            <summary>Можно ли разместить сайт на хостинге?</summary>
            <p>
              Пока работаем с локальной сдачей проекта. Размещение на хостинге и
              сопровождение появятся позже.
            </p>
          </details>
          <details className="rv">
            <summary>Какие файлы можно приложить к заявке?</summary>
            <p>
              Макеты, шаблоны, фото и документы: png, jpg, pdf, fig, zip, docx,
              txt до 10 МБ каждый.
            </p>
          </details>
        </div>
      </section>
      <section className="sec">
        <div className="band rv">
          <h2>Выбрали формат?</h2>
          <div className="band-action">
            <a className="btn" href="/order" data-magnet="">
              Оставить заявку
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
