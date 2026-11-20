export default function Home() {
  return (
    <>
      <section className="word-hero">
        <div className="hero-bottom">
          <h1>
            Сайты.
            <br />
            Приложения.
            <br />
            <em className="hl">Без воды.</em>
          </h1>
          <div className="cta">
            <a className="btn btn-primary" href="/order" data-magnet="">
              Оставить заявку
            </a>
            <a className="btn" href="/portfolio">
              Портфолио
            </a>
            <a className="btn" href="/chat?thread=direct&login=1">
              Связаться с менеджером
            </a>
          </div>
        </div>
      </section>
      <div className="home-sections">
        <section className="sec">
          <div className="sec-top rv">
            <h2 className="h2">Что делаем</h2>
            <a className="btn btn-sm" href="/services">
              Все услуги
            </a>
          </div>
          <div className="service-stack">
            <a className="service-sheet" href="/order?type=site">
              <span className="up">WEB</span>
              <img
                className="service-art"
                src="/assets/service-site.svg"
                width="300"
                height="190"
                alt=""
              />
              <h3>Сайты</h3>
            </a>
            <a className="service-sheet" href="/order?type=app">
              <span className="up">APK</span>
              <img
                className="service-art"
                src="/assets/service-app.svg"
                width="300"
                height="190"
                alt=""
              />
              <h3>Android</h3>
            </a>
            <a className="service-sheet" href="/order?type=small">
              <span className="up">MINI</span>
              <img
                className="service-art"
                src="/assets/service-small.svg"
                width="300"
                height="190"
                alt=""
              />
              <h3>Мини-проекты</h3>
            </a>
            <a className="service-sheet" href="/order?type=study">
              <span className="up">EDU</span>
              <img
                className="service-art"
                src="/assets/service-study.svg"
                width="300"
                height="190"
                alt=""
              />
              <h3>Учёба</h3>
            </a>
          </div>
        </section>

        <section
          className="sec order-story"
          aria-labelledby="order-story-title"
        >
          <div className="sec-top story-heading">
            <h2 id="order-story-title">Как заказать</h2>
            <a className="btn btn-sm" href="/services#process">
              Подробнее
            </a>
          </div>
          <div className="story-pin">
            <div className="story-copy">
              <ol className="story-steps">
                <li>
                  <span className="up">01</span>
                  <h3>Форма</h3>
                  <p>
                    Выбираешь тип проекта, описываешь задачу и оставляешь
                    контакты.
                  </p>
                </li>
                <li>
                  <span className="up">02</span>
                  <h3>Номер</h3>
                  <p>Получаешь номер заявки и предварительную оценку.</p>
                </li>
                <li>
                  <span className="up">03</span>
                  <h3>Детали</h3>
                  <p>
                    С менеджером согласуешь объём работы, сроки и стоимость.
                  </p>
                </li>
                <li>
                  <span className="up">04</span>
                  <h3>Работа</h3>
                  <p>Следишь за ходом проекта в чате и получаешь результат.</p>
                </li>
              </ol>
            </div>
            <ol className="story-map" aria-label="Путь заявки">
              <li>
                <span className="up">Задача → форма</span>
                <strong>Заявка</strong>
              </li>
              <li>
                <span className="up">Номер → менеджер</span>
                <strong>Оценка</strong>
              </li>
              <li>
                <span className="up">Объём → сроки → цена</span>
                <strong>Согласование</strong>
              </li>
              <li>
                <span className="up">Работа → сдача</span>
                <strong>Разработка</strong>
              </li>
            </ol>
          </div>
        </section>
        <section className="sec">
          <div className="band project-end rv">
            <h2>
              Начать
              <br />
              проект
            </h2>
            <div className="project-end-actions">
              <a className="btn" href="/order" data-magnet="">
                Оставить заявку
              </a>
              <button
                className="text-button"
                type="button"
                data-open="footer-contacts"
              >
                Telegram
              </button>
              <button
                className="text-button"
                type="button"
                data-open="footer-contacts"
              >
                ВКонтакте
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
