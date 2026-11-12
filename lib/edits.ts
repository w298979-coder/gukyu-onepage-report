// Design Ref: §3 — "수정·추가" 내용은 데이터베이스 없이 이 브라우저의 localStorage에만 보관한다.
// 구조: { [필지id]: { [항목]: Edit[] } } — 배열은 오래된 순서이며, 마지막이 현재 값이고 앞의 것들은 과거 값이다.
import type { EditableItem } from "./types";

export const STORAGE_KEY = "onboard-edits-v1";
export const MAX_TEXT = 500;
export const MAX_NAME = 20;

export interface Edit {
  값: string;
  수정자: string;
  수정시각: string; // ISO
}

export type EditStore = Record<string, Partial<Record<EditableItem, Edit[]>>>;

/** 저장된 글을 읽는다. 깨졌거나 모양이 다르면 빈 저장소로 본다. */
export function parseStore(raw: string | null | undefined): EditStore {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: EditStore = {};
    for (const [pid, items] of Object.entries(v as Record<string, unknown>)) {
      if (!items || typeof items !== "object") continue;
      for (const [item, list] of Object.entries(items as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue;
        const ok = list.filter(
          (e): e is Edit => !!e && typeof e.값 === "string" && typeof e.수정자 === "string" && typeof e.수정시각 === "string",
        );
        if (ok.length) (out[pid] ??= {})[item as EditableItem] = ok;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function getEdits(store: EditStore, parcelId: string, item: EditableItem): Edit[] {
  return store[parcelId]?.[item] ?? [];
}

export type ValidationResult = { ok: true; 값: string; 수정자: string } | { ok: false; error: string };

/** 입력값 검사: 둘 다 필수, 길이 제한. */
export function validateEdit(값: string, 수정자: string): ValidationResult {
  const v = 값.trim();
  const n = 수정자.trim();
  if (!n) return { ok: false, error: "수정자 이름을 입력하세요." };
  if (n.length > MAX_NAME) return { ok: false, error: `수정자 이름은 ${MAX_NAME}자 이하로 입력하세요.` };
  if (!v) return { ok: false, error: "수정·추가할 내용을 입력하세요." };
  if (v.length > MAX_TEXT) return { ok: false, error: `내용은 ${MAX_TEXT}자 이하로 입력하세요.` };
  return { ok: true, 값: v, 수정자: n };
}

/** 새 수정 기록을 덧붙인 저장소를 돌려준다(원본은 바꾸지 않는다). 이전 값은 배열 앞쪽에 그대로 남는다. */
export function addEdit(store: EditStore, parcelId: string, item: EditableItem, edit: Edit): EditStore {
  const prev = getEdits(store, parcelId, item);
  return { ...store, [parcelId]: { ...store[parcelId], [item]: [...prev, edit] } };
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 과거이력 창에 보여 줄 수정 기록(최근 것이 먼저). 현재 값은 맨 위 줄에 "(현재)"로 표시한다. */
export function editHistoryLines(list: Edit[]): string[] {
  return [...list]
    .reverse()
    .map((e, i) => `${formatTime(e.수정시각)} · 수정자 ${e.수정자} · ${e.값}${i === 0 ? " (현재 값)" : ""}`);
}
