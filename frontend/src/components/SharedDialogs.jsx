import QuickChat from '../features/chat/QuickChat';
import PalettePanel from './PalettePanel';
export default function SharedDialogs({ content = {} }) {
  return (
    <>
      {" "}
      <QuickChat/>
<PalettePanel/>
      <dialog
        className="dlg footer-dialog"
        id="footer-about"
        aria-labelledby="footer-about-title"
      >
        <button
          className="dlg-x"
          type="button"
          data-close=""
          aria-label="Закрыть"
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
        <div className="dlg-in">
          <h2 id="footer-about-title">О студии</h2>
          <p>
            {content.about?.text ??
              "DEVUP — студия разработки сайтов, Android-приложений и небольших проектов."}
          </p>
        </div>
      </dialog>
      <dialog
        className="dlg footer-dialog"
        id="footer-terms"
        aria-labelledby="footer-terms-title"
      >
        <button
          className="dlg-x"
          type="button"
          data-close=""
          aria-label="Закрыть"
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
        <div className="dlg-in">
          <h2 id="footer-terms-title">Условия</h2>
          <p>
            {content.terms?.text ??
              "Условия работы будут добавлены перед запуском сайта."}
          </p>
        </div>
      </dialog>
      <dialog
        className="dlg footer-dialog"
        id="footer-privacy"
        aria-labelledby="footer-privacy-title"
      >
        <button
          className="dlg-x"
          type="button"
          data-close=""
          aria-label="Закрыть"
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
        <div className="dlg-in">
          <h2 id="footer-privacy-title">Политика данных</h2>
          <p>
            {content.privacy?.text ??
              "Документ будет добавлен перед запуском сайта."}
          </p>
        </div>
      </dialog>
      <dialog
        className="dlg footer-dialog"
        id="footer-contacts"
        aria-labelledby="footer-contacts-title"
      >
        <button
          className="dlg-x"
          type="button"
          data-close=""
          aria-label="Закрыть"
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
        <div className="dlg-in">
          <h2 id="footer-contacts-title">Контакты студии</h2>
          <p>
            {content.contacts?.text ??
              "Адреса Telegram, ВКонтакте и почты пока не указаны."}
          </p>
        </div>
      </dialog>{" "}
    </>
  );
}
