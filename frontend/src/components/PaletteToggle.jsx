export default function PaletteToggle() { return (
          <button
            className="palette-toggle"
            type="button"
            id="pal-fab"
            aria-pressed="false" aria-label="Переключить тему" title="Светлая тема"
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a1 1 0 0 1 0-2h3a5 5 0 0 0 5-5c0-4-4-7-9-7Z" />
              <circle cx="7" cy="10" r=".8" />
              <circle cx="11" cy="7" r=".8" />
              <circle cx="16" cy="8" r=".8" />
            </svg>
          </button>
); }
