export function formatDeadline(value) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  const date = (part) => part.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2}\.\d{2})(\d)/, "$1.$2");
  return date(digits.slice(0, 8)) + (digits.length > 8 ? ` - ${date(digits.slice(8))}` : "");
}


