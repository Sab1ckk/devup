import kinds from "../../../shared/block-kinds.json";
export { kinds };
export const normalizeProjectType = (value) =>
  ["site", "app", "small", "study"].includes(value) ? value : "site";
export function canAddBlock(list, kind) {
  const spec = kinds.find((k) => k.code === kind);
  return (
    Boolean(spec) &&
    list.length < 30 &&
    (!spec.unique || !list.some((b) => b.kind === kind))
  );
}
export function createBlock(kind) {
  const spec = kinds.find((k) => k.code === kind);
  return spec
    ? { id: crypto.randomUUID(), kind, title: spec.title, description: "" }
    : null;
}
export function moveBlock(list, id, delta) {
  const from = list.findIndex((b) => b.id === id),
    to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return [...list];
  const copy = [...list],
    [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
export function placeBlock(list, id, before) {
  if (id === before) return [...list];
  const from = list.findIndex((b) => b.id === id);
  if (from < 0) return [...list];
  const copy = [...list],
    [item] = copy.splice(from, 1);
  const to =
    before == null ? copy.length : copy.findIndex((b) => b.id === before);
  if (to < 0) return [...list];
  copy.splice(to, 0, item);
  return copy;
}
