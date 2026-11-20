export default function Footer() {
  return (
    <>
      {" "}
      <footer className="foot">
        <div className="footer-inner">
          <a className="footer-logo" href="/" aria-label="DEVUP — главная">
            DEVUP<sup>®</sup>
          </a>
          <nav className="footer-legal" aria-label="О студии и документы">
            <button
              type="button"
              data-open="footer-about"
              aria-haspopup="dialog"
            >
              О студии
            </button>
            <button
              type="button"
              data-open="footer-terms"
              aria-haspopup="dialog"
            >
              Условия
            </button>
            <button
              type="button"
              data-open="footer-privacy"
              aria-haspopup="dialog"
            >
              Политика данных
            </button>
          </nav>
          <div className="footer-social" aria-label="Связь со студией">
            <button
              type="button"
              data-open="footer-contacts"
              aria-label="Telegram"
              aria-haspopup="dialog"
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 3 3 10l7 3 3 7L21 3ZM10 13 21 3" />
              </svg>
            </button>
            <button
              type="button"
              data-open="footer-contacts"
              aria-label="ВКонтакте"
              aria-haspopup="dialog"
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h4c.2 4.4 2 6.4 3 7V6h4v4c1.3-1 2.7-2.6 3.2-4H21c-.5 2.5-2.4 4.8-3.8 6.2 1.6 1.2 3.7 3.4 4 5.8h-4c-.5-1.8-2-3.5-3.2-4.2V18h-2C6 18 3.1 13 3 6Z" />
              </svg>
            </button>
            <button
              type="button"
              data-open="footer-contacts"
              aria-label="Электронная почта"
              aria-haspopup="dialog"
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5h18v14H3V5Zm0 0 9 8 9-8" />
              </svg>
            </button>
          </div>
        </div>
      </footer>{" "}
    </>
  );
}
