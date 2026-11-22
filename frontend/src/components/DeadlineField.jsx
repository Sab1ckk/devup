import { Field } from "./UI";

import { formatDeadline } from "../lib/deadline";

export default function DeadlineField({ value, onChange, ...props }) {
  function update(input, raw, digitPosition) {
    const formatted = formatDeadline(raw);
    onChange({ target: { name: props.name, value: formatted } });
    // Restore the caret by digit position so editing in the middle stays possible.
    let caret = 0, count = 0;
    while (caret < formatted.length && count < digitPosition) {
      if (/\d/.test(formatted[caret])) count++;
      caret++;
    }
    input.value = formatted;
    input.setSelectionRange(caret, caret);
  }

  return <Field {...props} value={value} inputMode="numeric"
    placeholder="дд.мм.гггг - дд.мм.гггг"
    hint="Одна дата — срок до указанной даты, две даты — диапазон."
    onChange={(event) => {
      const input = event.target;
      update(input, input.value, input.value.slice(0, input.selectionStart).replace(/\D/g, "").length);
    }}
    onKeyDown={(event) => {
      const input = event.currentTarget;
      const start = input.selectionStart;
      if (start !== input.selectionEnd) return;
      const backwards = event.key === "Backspace";
      const forwards = event.key === "Delete";
      if (!backwards && !forwards) return;
      const digits = input.value.replace(/\D/g, "");
      const position = input.value.slice(0, start).replace(/\D/g, "").length;
      const remove = backwards ? position - 1 : position;
      event.preventDefault();
      if (remove < 0 || remove >= digits.length) return;
      update(input, digits.slice(0, remove) + digits.slice(remove + 1), backwards ? remove : position);
    }} />;
}

