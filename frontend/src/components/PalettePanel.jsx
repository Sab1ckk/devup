export default function PalettePanel() {
  return (
    <aside className="pal" id="pal" hidden aria-label="Выбор палитры">
      <h4>Ваши пары цветов</h4>
      <div className="pal-g" id="pal-g"></div>
      <label className="check">
        <input type="checkbox" id="pal-inv" />
        <span>
          Светлая версия <small className="dim">(для светлых пар)</small>
        </span>
      </label>
      <button className="btn btn-sm" type="button" id="pal-reset">
        Дефолт
      </button>
    </aside>
  );
}
