import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import Builder from "../features/Builder";
import { useState } from "react";
import { createBlock } from "../lib/blocks";
afterEach(cleanup);
function Harness() {
  const [draft, setDraft] = useState({
    project_type: "site",
    blocks: ["hero", "about", "contacts"].map(createBlock),
  });
  return <Builder draft={draft} setDraft={setDraft} />;
}
describe("builder UI", () => {
  it("adds, moves and deletes blocks with accessible actions", () => {
    render(<Harness />);
    expect(
      screen.getByRole("button", { name: "Добавить блок «Главная»" }).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Добавить блок «Чат»" }),
    );
    expect(screen.getByRole("status").textContent).toContain("Добавлен блок");
    fireEvent.click(
      screen.getByRole("button", { name: "Переместить выше «Чат»" }),
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Порядок блоков изменён",
    );
    fireEvent.click(screen.getByRole("button", { name: "Удалить блок «Чат»" }));
    expect(
      screen.queryByRole("button", { name: "Удалить блок «Чат»" }),
    ).toBeNull();
  });
});
