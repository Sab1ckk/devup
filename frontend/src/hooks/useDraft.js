import { useEffect, useState } from "react";
import { createBlock, kinds, normalizeProjectType } from "../lib/blocks";
const KEY = "devup-mix-draft";
function empty() {
  return {
    project_type: normalizeProjectType(
      new URLSearchParams(location.search).get("type"),
    ),
    company_text: "",
    wishes_text: "",
    design_text: "",
    deadline_text: "",
    budget_text: "",
    email: "",
    telegram: "",
    vk: "",
    blocks: ["hero", "about", "contacts"].map(createBlock),
  };
}
function restore() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (
      stored &&
      Date.now() - stored.savedAt < 30 * 86400000 &&
      Array.isArray(stored.data.blocks)
    ) {
      const d = stored.data;
      const blocks = d.blocks
        .filter(
          (b) =>
            kinds.some((k) => k.code === b.kind) &&
            typeof b.title === "string" &&
            typeof b.description === "string",
        )
        .slice(0, 30)
        .map((b) => ({ ...b, id: crypto.randomUUID() }));
      return {
        data: {
          ...empty(),
          ...d,
          blocks,
          project_type: normalizeProjectType(d.project_type),
        },
        restored: true,
      };
    }
  } catch {
    /* unavailable or corrupted storage */
  }
  return { data: empty(), restored: false };
}
export default function useDraft(success) {
  const [initial] = useState(restore),
    [draft, setDraft] = useState(initial.data);
  useEffect(() => {
    if (success) {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* storage unavailable */
      }
      return;
    }
    const save = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), data: draft }));
      } catch {
        /* quota or privacy mode */
      }
    };
    const timer = setTimeout(save, 500);
    return () => {
      clearTimeout(timer);
      save();
    };
  }, [draft, success]);
  function clear() {
    setDraft(empty());
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable */
    }
  }
  return { draft, setDraft, restored: initial.restored, clear };
}
