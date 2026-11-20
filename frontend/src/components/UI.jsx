import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
const UIContext = createContext(null);
export function UIProvider({ children }) {
  const [dialog, setDialog] = useState(null),
    [message, setMessage] = useState("");
  const timer = useRef(null);
  const toast = useCallback((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 4000);
  }, []);
  const open = useCallback((id) => setDialog(id), []),
    close = useCallback(() => setDialog(null), []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <UIContext.Provider value={{ dialog, open, close, toast }}>
      {children}
      <div className={`toast${message ? " on" : ""}`} id="toast" role="status">
        {message}
      </div>
    </UIContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export const useUI = () => useContext(UIContext);
export function Dialog({ id, title, children, className = "", onClosed }) {
  const ref = useRef(null),
    opener = useRef(null);
  const { dialog, close } = useUI();
  useEffect(() => {
    if (dialog === id && !ref.current.open) {
      opener.current = document.activeElement;
      ref.current.showModal();
    } else if (dialog !== id && ref.current.open) ref.current.close();
  }, [dialog, id]);
  const restore = () => {
    if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    if (dialog === id) close();
    onClosed?.();
  };
  return (
    <dialog
      ref={ref}
      className={`dlg ${className}`}
      id={id}
      aria-labelledby={`${id}-title`}
      onClose={restore}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <button
        className="dlg-x"
        type="button"
        aria-label="Закрыть"
        onClick={close}
      >
        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
      <div className="dlg-in">
        <h2 id={`${id}-title`}>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
export function ErrorHint({ error }) {
  return error ? (
    <p className="hint field-error" role="alert">
      {error.message || error}
    </p>
  ) : null;
}
export function Field({
  label,
  name,
  value,
  onChange,
  hint,
  type = "text",
  ...props
}) {
  return (
    <label className="fl">
      <span id={`${name}-label`}>{label}</span>
      <input
        type={type}
        aria-labelledby={`${name}-label`}
        aria-describedby={hint ? `${name}-hint` : undefined}
        name={name}
        id={name}
        value={value}
        onChange={onChange}
        {...props}
      />
      {hint && (
        <small className="hint" id={`${name}-hint`}>
          {hint}
        </small>
      )}
    </label>
  );
}
