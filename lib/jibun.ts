// Design Ref: §3.2 — 지번 입력을 정리(표기 변형 통일)하고 필지 목록에서 찾는다.
// Plan: 작업 5. 화면과 분리한 순수 함수라서 scripts/test-jibun.mjs 로 따로 시험한다.
import type { Parcel } from "./types";

/** 입력을 받아들이는 최대 길이(남용·이상 입력 방지) */
export const MAX_INPUT_LENGTH = 60;

/** 정리된 지번. gu·dong은 입력에 없으면 null이고, 그 경우 구·동 구분 없이 번호만 맞춘다. */
export interface JibunQuery {
  gu: string | null;
  dong: string | null;
  /** "산" 번지 여부 */
  san: boolean;
  main: number;
  sub: number;
}

export type ParseResult =
  | { ok: true; query: JibunQuery }
  | { ok: false; reason: string };

const IGNORED_TOKENS = new Set(["대전광역시", "대전시", "대전"]);

/**
 * 지번 문자열을 정리한다. 다음 표기를 같은 값으로 본다.
 *  - "가양동 174-59", "가양동174-59", "가양동 174번지 59", "가양동 174의 59", "대전광역시 동구 가양동 174-59"
 *  - "산 50-3", "산50-3", "산50번지3"
 */
export function parseJibun(input: string): ParseResult {
  const raw = (input ?? "").normalize("NFC").trim();
  if (raw === "") return { ok: false, reason: "지번을 입력해 주세요. 예: 가양동 174-59" };
  if (raw.length > MAX_INPUT_LENGTH) {
    return { ok: false, reason: `지번은 ${MAX_INPUT_LENGTH}자 이내로 입력해 주세요.` };
  }

  const s = raw
    .replace(/[‐‑–—−~]/g, "-") // 여러 가지 하이픈을 통일
    .replace(/번지\s*(?=\d)/g, "-") // "50번지3" → "50-3"
    .replace(/번지/g, "") // "174번지" → "174"
    .replace(/의\s*(?=\d)/g, "-") // "174의 59" → "174-59"
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const m = s.match(/^(.*?)(산)?\s*(\d{1,5})(?:-(\d{1,4}))?$/);
  if (!m) return { ok: false, reason: "지번 형식을 확인해 주세요. 예: 가양동 174-59, 갈전동 산 50-3" };

  const prefix = m[1].trim();
  if (/\d/.test(prefix)) return { ok: false, reason: "지번 형식을 확인해 주세요. 예: 가양동 174-59, 갈전동 산 50-3" };

  let gu: string | null = null;
  let dong: string | null = null;
  for (const token of prefix.split(" ").filter(Boolean)) {
    if (IGNORED_TOKENS.has(token)) continue;
    if (/[구]$/.test(token) && token.length >= 2) gu = token;
    else if (/[동리]$/.test(token) && token.length >= 2) dong = token;
    else if (/(시|도|군)$/.test(token)) return { ok: false, reason: "대전광역시 지번만 조회할 수 있어요." };
    else return { ok: false, reason: `"${token}"을(를) 알아볼 수 없어요. 예: 가양동 174-59` };
  }

  return {
    ok: true,
    query: { gu, dong, san: Boolean(m[2]), main: Number(m[3]), sub: m[4] ? Number(m[4]) : 0 },
  };
}

/** 필지 소재지("대전광역시 동구 가양동 174-59")를 같은 방식으로 풀어 둔다. */
export interface ParcelAddress {
  gu: string | null;
  dong: string | null;
  san: boolean;
  main: number;
  sub: number;
}

export function parseParcelAddress(address: string): ParcelAddress {
  const r = parseJibun(address);
  if (!r.ok) throw new Error(`필지 소재지를 읽을 수 없음: ${address} (${r.reason})`);
  return r.query;
}

/** 입력한 지번과 맞는 필지를 모두 찾는다. 번지 번호·산 여부는 정확히 같아야 하고, 구·동은 입력했을 때만 비교한다. */
export function findParcels(query: JibunQuery, parcels: Parcel[]): Parcel[] {
  return parcels.filter((p) => {
    const a = parseParcelAddress(p.지번);
    return (
      a.main === query.main &&
      a.sub === query.sub &&
      a.san === query.san &&
      (query.gu === null || a.gu === query.gu) &&
      (query.dong === null || a.dong === query.dong)
    );
  });
}

/** 화면에 보여 줄 짧은 소재지 (예: "동구 가양동 174-59") */
export function shortAddress(address: string): string {
  return address.replace(/^대전광역시\s*/, "");
}
