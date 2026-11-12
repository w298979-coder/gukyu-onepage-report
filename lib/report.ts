// Design Ref: §2 — 필지 한 건을 리포트 화면에 쓸 글(문자열)로 바꾼다. 화면(컴포넌트)과 분리해 시험하기 쉽게 한다.
// Plan: 작업 6. 값이 없으면 빈칸이 아니라 "해당 없음", 면적은 ㎡, 출처(브이월드/포털/가상/수정)를 함께 보여준다.
import type { Complaint, Lease, Occupant, Parcel, Penalty, Source } from "./types";

export const NONE = "해당 없음";

export const fmtArea = (v: number | null | undefined): string =>
  v === null || v === undefined ? NONE : `${v.toLocaleString("ko-KR")}㎡`;
export const fmtWon = (v: number | null | undefined): string =>
  v === null || v === undefined ? NONE : `${v.toLocaleString("ko-KR")}원`;
export const fmtDate = (v: string | null | undefined): string => (v ? v : NONE);
const text = (v: string | null | undefined): string => (v && v.trim() !== "" ? v : NONE);

export interface BasicRow {
  label: string;
  value: string;
  /** 값이 없으면(해당 없음) 출처를 붙이지 않는다 */
  source: Source | null;
  note?: string;
}

/** 카드 하나: 한 줄 요약 + 세부확인에서 보여 줄 줄들 */
export interface ListCard {
  /** 카드 머리의 짧은 건수 표시 (예: "2건") */
  count: string;
  summary: string[];
  detail: string[];
  source: Source | null;
}

export interface ReportView {
  title: string;
  basic: BasicRow[];
  basicDetail: string[];
  occupants: ListCard;
  leases: ListCard;
  penalties: ListCard;
  complaints: ListCard;
  etc: { rows: BasicRow[]; detail: string[] };
}

const MAX_SUMMARY = 3;

function limit(lines: string[], total: number): string[] {
  if (lines.length === 0) return [NONE];
  return total > MAX_SUMMARY ? [...lines.slice(0, MAX_SUMMARY), `외 ${total - MAX_SUMMARY}건 (세부확인)`] : lines;
}

function ownerName(occ: Occupant[], id: string): string {
  return occ.find((o) => o.id === id)?.이름 ?? "점유자 미상";
}

const leaseLine = (l: Lease, name: string) =>
  `${name} · ${l.상태} · ${fmtDate(l.계약시작일)} ~ ${fmtDate(l.계약종료일)} · 연 사용료 ${fmtWon(l.연사용료)}`;
const penaltyLine = (x: Penalty, name: string) => `${name} · ${fmtDate(x.부과일)} 부과 · ${fmtWon(x.금액)} · ${x.납부상태}`;
const complaintLine = (c: Complaint) => `${fmtDate(c.접수일)} · ${c.처리상태} · ${c.내용}`;

export function buildReport(p: Parcel): ReportView {
  const area = p.면적;
  const basic: BasicRow[] = [
    { label: "소재지", value: p.지번, source: "포털" },
    { label: "구분", value: p.구분, source: "포털" },
    { label: "상태", value: p.상태, source: "포털" },
    {
      label: "면적",
      value: fmtArea(area.value),
      source: area.value === null ? null : area.source,
      note: area.alt
        ? `필지 전체 ${fmtArea(area.alt.value)} (${area.alt.source})`
        : area.source === "브이월드" && area.value !== null
          ? "포털에 면적 값이 없어 브이월드 값을 사용"
          : undefined,
    },
    { label: "지목", value: text(p.지목.value), source: p.지목.value === null ? null : p.지목.source },
    {
      label: "실제지목",
      value: text(p.실제지목.value),
      source: p.실제지목.value === null ? null : p.실제지목.source,
      note: p.실제지목.value === null ? "브이월드에 토지특성 정보가 없음" : undefined,
    },
  ];

  const basicDetail = [
    "면적은 포털의 국유재산 면적을 기본으로 보여주고, 브이월드의 필지 전체 면적과 다르면 함께 표시합니다.",
    "지목은 브이월드를 기준으로 하고, 실제지목은 브이월드 토지특성정보의 이용상황입니다.",
    "소재지·구분·상태는 캠코 국유재산포털 값입니다.",
    ...basic.filter((r) => r.note).map((r) => `${r.label}: ${r.note}`),
  ];

  // 점유자 + 점유자별 대부계약
  const occLines = p.점유자.map((o) => {
    const mine = p.대부계약.filter((l) => l.점유자id === o.id);
    return `${o.이름} · 점유 ${fmtArea(o.점유면적)} · ${fmtDate(o.점유시작일)}부터${o.비고 ? ` · ${o.비고}` : ""}${
      mine.length ? ` · 대부계약 ${mine.length}건` : " · 대부계약 없음"
    }`;
  });
  const occupants: ListCard = {
    count: p.점유자.length === 0 ? NONE : `${p.점유자.length}명`,
    summary: limit(occLines, p.점유자.length),
    detail: p.점유자.length === 0 ? [NONE] : p.점유자.flatMap((o) => {
      const mine = p.대부계약.filter((l) => l.점유자id === o.id);
      return [
        `${o.이름}: 점유면적 ${fmtArea(o.점유면적)}, 점유 시작 ${fmtDate(o.점유시작일)}, 비고 ${text(o.비고)}`,
        ...(mine.length ? mine.map((l) => `  - 대부계약: ${leaseLine(l, o.이름)}`) : ["  - 대부계약: 없음"]),
      ];
    }),
    source: p.점유자.length === 0 ? null : "가상",
  };

  const leaseLines = p.대부계약.map((l) => leaseLine(l, ownerName(p.점유자, l.점유자id)));
  const leases: ListCard = {
    count: p.대부계약.length === 0 ? NONE : `${p.대부계약.length}건`,
    summary: limit(leaseLines, p.대부계약.length),
    detail: p.대부계약.length === 0 ? [NONE] : leaseLines,
    source: p.대부계약.length === 0 ? null : "가상",
  };

  const penLines = p.변상금.map((x) => penaltyLine(x, ownerName(p.점유자, x.점유자id)));
  const unpaid = p.변상금.filter((x) => x.납부상태 !== "완납").length;
  const penalties: ListCard = {
    count: p.변상금.length === 0 ? NONE : `${p.변상금.length}건${unpaid ? ` · 미완납 ${unpaid}` : ""}`,
    summary: limit(penLines, p.변상금.length),
    detail: p.변상금.length === 0 ? [NONE] : penLines,
    source: p.변상금.length === 0 ? null : "가상",
  };

  const cLines = p.민원.map(complaintLine);
  const open = p.민원.filter((c) => c.처리상태 !== "완료").length;
  const complaints: ListCard = {
    count: p.민원.length === 0 ? NONE : `${p.민원.length}건${open ? ` · 미완료 ${open}` : ""}`,
    summary: limit(cLines, p.민원.length),
    detail: p.민원.length === 0 ? [NONE] : cLines,
    source: p.민원.length === 0 ? null : "가상",
  };

  // 기타 관리사항: 공시지가(최신), 용도지역, 관리 메모
  const prices = p.공시지가.value;
  const latest = prices && prices.length ? prices[prices.length - 1] : null;
  const zones = p.용도지역.value;
  const etcRows: BasicRow[] = [
    {
      label: "개별공시지가",
      value: latest ? `${latest.단가.toLocaleString("ko-KR")}원/㎡ (${latest.연도}년)` : NONE,
      source: latest ? p.공시지가.source : null,
    },
    {
      label: "용도지역·지구",
      value: zones && zones.length ? (zones.length > 2 ? `${zones.slice(0, 2).join(", ")} 외 ${zones.length - 2}` : zones.join(", ")) : NONE,
      source: zones && zones.length ? p.용도지역.source : null,
    },
    { label: "관리 메모", value: text(p.기타관리사항.value), source: p.기타관리사항.value ? p.기타관리사항.source : null },
  ];
  const etcDetail = [
    `개별공시지가(최신): ${etcRows[0].value}`,
    `용도지역·지구 전체: ${zones && zones.length ? zones.join(", ") : NONE}`,
    `관리 메모: ${etcRows[2].value}`,
  ];

  return {
    title: p.지번,
    basic,
    basicDetail,
    occupants,
    leases,
    penalties,
    complaints,
    etc: { rows: etcRows, detail: etcDetail },
  };
}
