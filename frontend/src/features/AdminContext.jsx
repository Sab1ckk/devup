import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";
const Context = createContext(null);
function flag() {
  try {
    return Boolean(localStorage.getItem("devup-mix-admin"));
  } catch {
    return false;
  }
}
function setFlag(value) {
  try {
    if (value) localStorage.setItem("devup-mix-admin", "true");
    else localStorage.removeItem("devup-mix-admin");
  } catch {
    /* private mode */
  }
}
export function AdminProvider({ children }) {
  const onAdmin = useLocation().pathname.startsWith("/admin");
  const [admin, setAdmin] = useState(null),
    [loading, setLoading] = useState(onAdmin || flag()),
    [expired, setExpired] = useState(false);
  const [preview, setPreviewState] = useState(() => {
    try {
      return sessionStorage.getItem("devup-admin-preview") === "true";
    } catch {
      return false;
    }
  });
  const setPreview = (value) => {
    setPreviewState(value);
    try {
      sessionStorage.setItem("devup-admin-preview", String(value));
    } catch {
      /* private mode */
    }
  };
  const accept = useCallback((user) => {
    setAdmin(user);
    setFlag(true);
    setExpired(false);
  }, []);
  const clear = useCallback(() => {
    setAdmin(null);
    setFlag(false);
  }, []);
  useEffect(() => {
    if (!onAdmin && !flag()) return;
    let live = true;
    api("/admin/auth/me")
      .then((r) => {
        if (live) accept(r.admin);
      })
      .catch(() => {
        if (live) clear();
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [onAdmin, accept, clear]);
  useEffect(() => {
    const handler = () => {
      clear();
      setExpired(true);
    };
    window.addEventListener("devup-admin-expired", handler);
    return () => window.removeEventListener("devup-admin-expired", handler);
  }, [clear]);
  const logout = async () => {
    try {
      await api("/admin/auth/logout", {});
    } finally {
      clear();
      setPreview(false);
    }
  };
  return (
    <Context.Provider
      value={{ admin, loading, accept, logout, expired, preview, setPreview }}
    >
      {children}
    </Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAdmin = () => useContext(Context);
export function AdminBar() {
  const { admin, preview, setPreview, logout } = useAdmin();
  if (!admin) return null;
  return (
    <aside className="admin-bar up" aria-label="Режим администратора">
      <span>Режим админа</span>
      <a href="/admin/services">Править услуги</a>
      <a href="/admin/portfolio">Править портфолио</a>
      <a href="/admin/requests">В админку</a>
      <label className="check">
        <input
          type="checkbox"
          checked={preview}
          onChange={(e) => setPreview(e.target.checked)}
        />
        <span>Показывать черновики</span>
      </label>
      <button type="button" onClick={logout}>
        Выйти
      </button>
    </aside>
  );
}
