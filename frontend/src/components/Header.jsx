import PaletteToggle from './PaletteToggle';
import { useAuth } from "../features/AuthContext";
import { useNavigate } from "react-router-dom";
export default function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <>
      {" "}
      <header className="site-header">
        <div className="header-inner">
          <a className="logo" href="/" aria-label="DEVUP — главная">
            DEVUP<sup>®</sup>
          </a>
          <nav className="nav" id="site-navigation" aria-label="Разделы">
            <a href="/">Главная</a>
            <a href="/services">Услуги</a>
            <a href="/portfolio">Портфолио</a>
            <a href="/reviews">Отзывы</a>
            <a href="/order">Заявка</a>
          </nav>
          <div className="header-actions">
            <PaletteToggle />
            <button
              className="btn account-button"
              data-open={user ? undefined : "auth"}
              onClick={() => {
                if (user) navigate("/cabinet");
              }}
              type="button"
              aria-haspopup="dialog"
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5 21a7 7 0 0 1 14 0" />
              </svg>
              <span>{user ? "Кабинет" : "Войти"}</span>
            </button>
            <a className="btn btn-primary" href="/order">
              Заказать
            </a>
            <button
              className="menu-btn"
              aria-label="Открыть меню"
              aria-controls="site-navigation"
              aria-expanded="false"
              type="button"
            >
              <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>{" "}
    </>
  );
}
