// Design Ref: §3 — "수정·추가" 내용은 데이터베이스 없이 이 브라우저의 localStorage에만 보관한다.
// 구조: { [필지id]: { [항목]: Edit[] } } — 배열은 오래된 순서이며, 마지막이 현재 값(원래 값을 덮어씀)이고
// 각 기록의 이전값에 바로 앞에 보이던 값(첫 수정이면 원래 값)을 남긴다.
import type { EditableItem } from "./types";

export const STORAGE_KEY = "onboard-edits-v1";
export const MAX_TEXT = 500;
export const MAX_NAME = 20;
export const MAX_PREV = 2000;

export interface Edit {
  값: string;
  /** 이 수정 직전에 보이던 값(첫 수정이면 원래 값) */
  이전값: string;
  수정자: string;
  수정시각: string; // ISO
}

export type EditStore = Record<string, Partial<Record<EditableItem, Edit[]>>>;

const ITEMS = new Set<string>(["점유자", "대부계약", "변상금", "민원"]); // lib/types.ts 의 EDITABLE_ITEMS 와 같은 값
const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

/** 저장된 글을 읽는다. 깨졌거나 모양이 다르면 빈 저장소로 본다. 이름·길이가 맞지 않는 기록은 버린다. */
export function parseStore(raw: string | null | undefined): EditStore {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: EditStore = Object.create(null);
    for (const [pid, items] of Object.entries(v as Record<string, unknown>)) {
      if (UNSAFE.has(pid) || !items || typeof items !== "object") continue;
      for (const [item, list] of Object.entries(items as Record<string, unknown>)) {
        if (!ITEMS.has(item) || !Array.isArray(list)) continue;
        const ok: Edit[] = [];
        for (const e of list) {
          if (!e || typeof e.값 !== "string" || typeof e.수정자 !== "string" || typeof e.수정시각 !== "string") continue;
          if (e.값.length > MAX_TEXT || e.수정자.length > MAX_NAME) continue;
          const prev = typeof e.이전값 === "string" ? e.이전값.slice(0, MAX_PREV) : "";
          ok.push({ 값: e.값, 이전값: prev, 수정자: e.수정자, 수정시각: e.수정시각 });
        }
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

/**
 * 새 수정 기록을 덧붙인 저장소를 돌려준다(원본은 바꾸지 않는다).
 * 이전값은 호출한 쪽이 정하지 않고 여기서 정한다: 앞선 수정이 있으면 그 값, 없으면 원래 값(original).
 */
export function addEdit(
  store: EditStore,
  parcelId: string,
  item: EditableItem,
  edit: { 값: string; 수정자: string; 수정시각: string },
  original: string,
): EditStore {
  const prev = getEdits(store, parcelId, item);
  const 이전값 = (prev.length ? prev[prev.length - 1].값 : original).slice(0, MAX_PREV);
  const next = Object.assign(Object.create(null), store) as EditStore;
  next[parcelId] = { ...store[parcelId], [item]: [...prev, { ...edit, 이전값 }] };
  return next;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 과거이력 창에 보여 줄 수정 기록(최근 것이 먼저). 각 기록 아래에 그때 덮어쓴 이전 값을 함께 적는다. */
export function editHistoryLines(list: Edit[]): string[] {
  return [...list]
    .reverse()
    .map((e, i) => `${formatTime(e.수정시각)} · 수정자 ${e.수정자} · ${e.값}${i === 0 ? " (현재 값)" : ""}\n  이전 값: ${e.이전값 || "해당 없음"}`);
}
