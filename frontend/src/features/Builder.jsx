import { useEffect, useRef, useState } from "react";
import {
  canAddBlock,
  createBlock,
  kinds,
  moveBlock,
  placeBlock,
} from "../lib/blocks";
const paths = {
  up: "m6 14 6-6 6 6M12 8v12",
  down: "m6 10 6 6 6-6M12 4v12",
  close: "m6 6 12 12M6 18 18 6",
  plus: "M12 4v16M4 12h16",
  check: "m5 12 4 4L19 6",
  home: "m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8",
  info: "M12 11v6M12 7v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
  chat: "M4 4h16v12H9l-5 4V4ZM8 8h8M8 12h5",
};
function Icon({ name }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.plus} />
    </svg>
  );
}
export default function Builder({ draft, setDraft, disabled }) {
  const { blocks, project_type } = draft,
    drag = useRef(null),
    focus = useRef(null),
    root = useRef(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (focus.current) {
      root.current.querySelector(`[data-id="${focus.current}"] input`)?.focus({ preventScroll: true });
      focus.current = null;
    }
  }, [blocks]);
  function changeBlocks(next, message) {
    setDraft((d) => ({ ...d, blocks: next }));
    setAnnouncement(message);
  }
  function insert(kind, before = null) {
    if (!canAddBlock(blocks, kind)) return;
    const block = createBlock(kind),
      copy = [...blocks],
      index = before ? copy.findIndex((b) => b.id === before) : copy.length;
    if (index < 0) return;
    copy.splice(index, 0, block);
    changeBlocks(copy, `Добавлен блок «${block.title}». Всего: ${copy.length}`);
  }
  function drop(e, before = null) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !drag.current) return;
    if (drag.current.kind) insert(drag.current.kind, before);
    else
      changeBlocks(
        placeBlock(blocks, drag.current.id, before),
        "Порядок блоков изменён",
      );
    drag.current = null;
  }
  function remove(index) {
    const next = blocks.filter((_, i) => i !== index);
    focus.current = next[Math.min(index, next.length - 1)]?.id;
    changeBlocks(next, `Блок удалён. Всего: ${next.length}`);
    if (!next.length)
      document.querySelector(".library-block:not(:disabled)")?.focus({ preventScroll: true });
  }
  return (
    <div className="builder">
      <aside className="block-library">
        <span className="up">01 / выбери основу</span>
        <div className="type-picks" role="group" aria-label="Тип проекта">
          {[
            ["site", "Сайт"],
            ["app", "Android"],
            ["small", "Мини-проект"],
            ["study", "Учебная задача"],
          ].map(([type, title]) => (
            <button
              type="button"
              key={type}
              className={project_type === type ? "active" : ""}
              aria-pressed={project_type === type}
              disabled={disabled}
              onClick={() => {
                setDraft((d) => ({ ...d, project_type: type }));
                setAnnouncement(`Тип проекта: ${title}`);
              }}
            >
              {title}
            </button>
          ))}
        </div>
        <h2>Добавить блок</h2>
        <p className="dim">Нажми или перетащи на полотно.</p>
        <div id="block-library">
          {["Страницы", "Функции", "Свой блок"].map((group) => (
            <section className="library-group" key={group}>
              <h3>{group}</h3>
              {kinds
                .filter((k) => k.group === group)
                .map((k) => {
                  const available = canAddBlock(blocks, k.code);
                  return (
                    <button
                      className="library-block"
                      type="button"
                      key={k.code}
                      disabled={!available || disabled}
                      draggable={available && !disabled}
                      aria-label={`Добавить блок «${k.title}»`}
                      onDragStart={(e) => {
                        drag.current = { kind: k.code };
                        e.dataTransfer.setData("text/plain", "upup-library");
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onDragEnd={() => (drag.current = null)}
                      onClick={() => insert(k.code)}
                    >
                      <b aria-hidden="true">
                        <Icon name={k.icon} />
                      </b>
                      <span>{k.title}</span>
                      <span aria-hidden="true">
                        <Icon name={available ? "plus" : "check"} />
                      </span>
                    </button>
                  );
                })}
            </section>
          ))}
        </div>
      </aside>
      <section
        className="builder-canvas"
        aria-label="Полотно заявки"
        onDragOver={(e) => {
          if (drag.current) e.preventDefault();
        }}
        onDrop={drop}
      >
        <div className="canvas-head">
          <span className="up">02 / собери структуру</span>
          <span id="block-count" role="status">
            {announcement || `Блоков: ${blocks.length}`}
          </span>
        </div>
        <div id="project-blocks" ref={root}>
          {blocks.map((block, index) => {
            const spec = kinds.find((k) => k.code === block.kind);
            return (
              <section
                key={block.id}
                className="project-block"
                data-id={block.id}
                onDragStart={(e) => {
                  if (!e.target.closest(".block-drag-handle")) {
                    e.preventDefault();
                    return;
                  }
                  drag.current = { id: block.id };
                  e.dataTransfer.setData("text/plain", "upup-block");
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => (drag.current = null)}
                onDragOver={(e) => {
                  if (drag.current) e.preventDefault();
                }}
                onDrop={(e) => drop(e, block.id)}
              >
                <div className="project-block-head">
                  <span className="block-number block-drag-handle" draggable={!disabled} title="Перетащи блок">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="block-label">{spec.title}</h3>
                  <div className="block-actions">
                    {[
                      ["up", "Переместить выше", -1],
                      ["down", "Переместить ниже", 1],
                      ["close", "Удалить блок", 0],
                    ].map(([action, title, delta]) => (
                      <button
                        type="button"
                        key={action}
                        disabled={
                          disabled ||
                          (action === "up" && index === 0) ||
                          (action === "down" && index === blocks.length - 1)
                        }
                        aria-label={`${title} «${block.title}»`}
                        onClick={() => {
                          if (!delta) remove(index);
                          else {
                            focus.current = block.id;
                            changeBlocks(
                              moveBlock(blocks, block.id, delta),
                              "Порядок блоков изменён",
                            );
                          }
                        }}
                      >
                        <Icon name={action} />
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  <span>Название блока</span>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    disabled={disabled}
                    value={block.title}
                    onChange={(e) =>
                      changeBlocks(
                        blocks.map((b) =>
                          b.id === block.id
                            ? { ...b, title: e.target.value }
                            : b,
                        ),
                        "",
                      )
                    }
                  />
                </label>
                <label>
                  <span>Что должно быть внутри?</span>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    disabled={disabled}
                    value={block.description}
                    placeholder={spec.hint}
                    onChange={(e) =>
                      changeBlocks(
                        blocks.map((b) =>
                          b.id === block.id
                            ? { ...b, description: e.target.value }
                            : b,
                        ),
                        "",
                      )
                    }
                  />
                </label>
              </section>
            );
          })}
        </div>
        <div id="builder-empty" hidden={blocks.length !== 0}>
          Пока пусто. Добавь первый блок из библиотеки.
        </div>
        <div className="drop-target" id="drop-target">
          <Icon name="plus" /> Перетащи блок сюда или выбери слева
        </div>
      </section>
    </div>
  );
}
