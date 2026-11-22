import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import DeadlineField from "../components/DeadlineField";
import { formatDeadline } from "../lib/deadline";

afterEach(cleanup);

it("formats a single deadline or a date range, including pasted text", () => {
  expect(formatDeadline("25122026")).toBe("25.12.2026");
  expect(formatDeadline("25.12.2026 - 31.12.2026")).toBe("25.12.2026 - 31.12.2026");
  expect(formatDeadline("251220263112202699")).toBe("25.12.2026 - 31.12.2026");
  expect(formatDeadline("")).toBe("");
});

it("keeps the caret while editing and deletes through separators", () => {
  function Harness() {
    const [value, setValue] = useState("");
    return <DeadlineField label="Сроки" name="deadline_text" value={value} onChange={e => setValue(e.target.value)} />;
  }
  render(<Harness />);
  const input = screen.getByLabelText("Сроки");
  fireEvent.change(input, { target: { value: "25122026", selectionStart: 8 } });
  expect(input.value).toBe("25.12.2026");
  input.setSelectionRange(3, 3);
  fireEvent.keyDown(input, { key: "Backspace" });
  expect(input.value).toBe("21.22.026");
  expect(input.selectionStart).toBe(1);
  fireEvent.change(input, { target: { value: "25.12.2026 - 31.12.2026", selectionStart: 23 } });
  expect(input.value).toBe("25.12.2026 - 31.12.2026");
  input.setSelectionRange(13, 13);
  fireEvent.keyDown(input, { key: "Delete" });
  expect(input.value).toBe("25.12.2026 - 11.22.026");
  expect(input.selectionStart).toBe(10);
});

