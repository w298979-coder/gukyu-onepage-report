// Design Ref: §2 — 점유자별 리포트. 필지별 리포트와 반대로 "점유자 한 명(가상 데이터의 같은 이름)"이 점유하는 모든 필지의
// 대부계약·변상금·민원을 한 장으로 모은다. AI를 쓰지 않고 코드가 정한 규칙으로 주의사항·관리방안을 만든다. 데이터는 인자로 받아 시험하기 쉽게 한다.
import type { Complaint, Lease, Occupant, Parcel, Penalty } from "./types";

export const EXPIRY_WARN_DAYS = 180; // 대부계약 만료가 이 일수 안이면 "만료 임박"

export interface OccupantRow {
  parcel: Parcel;
  occupant: Occupant;
  leases: Lease[];
  penalties: Penalty[];
  complaints: Complaint[];
  /** 이 점유자가 이 필지에서 유효한 대부계약 없이 점유 중이면 true */
  noValidLease: boolean;
}

export interface OccupantListItem {
  이름: string;
  필지수: number;
  대부계약수: number;
  변상금수: number;
  미납변상금수: number;
}

export interface Sentence {
  text: string;
  /** 근거 조문 id(국유재산법 등 저장된 조문). 화면에서 조문 이름·번호로 바꿔 보여 준다 */
  articleIds: string[];
}

export interface OccupantReport {
  이름: string;
  rows: OccupantRow[];
  totals: {
    parcels: number;
    area: number;
    validLeases: number;
    leaseFee: number;
    penalties: number;
    penaltyAmount: number;
    unpaidCount: number;
    unpaidAmount: number;
    openComplaints: number;
  };
  cautions: Sentence[];
  plan: Sentence[];
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function rowsFor(parcels: Parcel[], name: string): OccupantRow[] {
  const rows: OccupantRow[] = [];
  for (const parcel of parcels) {
    for (const occupant of parcel.점유자) {
      if (occupant.이름 !== name) continue;
      const leases = parcel.대부계약.filter((l) => l.점유자id === occupant.id);
      rows.push({
        parcel,
        occupant,
        leases,
        penalties: parcel.변상금.filter((x) => x.점유자id === occupant.id),
        complaints: parcel.민원,
        noValidLease: !leases.some((l) => l.상태 === "유효"),
      });
    }
  }
  return rows;
}

/** 점유자 이름별 목록(필지 수가 많은 순) */
export function listOccupants(parcels: Parcel[]): OccupantListItem[] {
  const names = [...new Set(parcels.flatMap((p) => p.점유자.map((o) => o.이름)))];
  return names
    .map((이름) => {
      const rows = rowsFor(parcels, 이름);
      const pens = rows.flatMap((r) => r.penalties);
      return {
        이름,
        필지수: rows.length,
        대부계약수: rows.reduce((a, r) => a + r.leases.length, 0),
        변상금수: pens.length,
        미납변상금수: pens.filter((x) => x.납부상태 !== "완납").length,
      };
    })
    .sort((a, b) => b.필지수 - a.필지수 || a.이름.localeCompare(b.이름));
}

/** 점유자 한 명의 리포트. 그 이름의 점유자가 없으면 null */
export function buildOccupantReport(parcels: Parcel[], name: string, today: string): OccupantReport | null {
  const rows = rowsFor(parcels, name);
  if (rows.length === 0) return null;

  const leases = rows.flatMap((r) => r.leases);
  const pens = rows.flatMap((r) => r.penalties);
  const unpaid = pens.filter((x) => x.납부상태 !== "완납");
  const openComplaints = rows.flatMap((r) => r.complaints).filter((c) => c.처리상태 !== "완료").length;
  const valid = leases.filter((l) => l.상태 === "유효");
  const totals = {
    parcels: rows.length,
    area: rows.reduce((a, r) => a + (r.occupant.점유면적 ?? 0), 0),
    validLeases: valid.length,
    leaseFee: valid.reduce((a, l) => a + (l.연사용료 ?? 0), 0),
    penalties: pens.length,
    penaltyAmount: pens.reduce((a, x) => a + (x.금액 ?? 0), 0),
    unpaidCount: unpaid.length,
    unpaidAmount: unpaid.reduce((a, x) => a + (x.금액 ?? 0), 0),
    openComplaints,
  };

  // ---- 주의사항(규칙): 자료에 실제 있는 사실만 쓰고 근거 조문을 붙인다 ----
  const cautions: Sentence[] = [];
  const plan: Sentence[] = [];
  const noLease = rows.filter((r) => r.noValidLease);
  const expiring = rows.flatMap((r) =>
    r.leases
      .filter((l) => l.상태 === "유효" && l.계약종료일 && daysBetween(today, l.계약종료일) >= 0 && daysBetween(today, l.계약종료일) <= EXPIRY_WARN_DAYS)
      .map((l) => ({ r, l, d: daysBetween(today, l.계약종료일 as string) })),
  );

  if (unpaid.length > 0) {
    cautions.push({
      text: `[변상금] 미납·일부납부 변상금 ${unpaid.length}건(부과액 합계 ${won(totals.unpaidAmount)})이 있습니다. 납기 후에는 연체료 징수와 강제징수 대상이 됩니다.`,
      articleIds: ["국유재산법-제72조", "국유재산법-제73조"],
    });
  }
  if (noLease.length > 0) {
    cautions.push({
      text: `[점유] 유효한 대부계약 없이 점유 중인 필지가 ${noLease.length}건(${noLease.map((r) => shortLot(r.parcel.지번)).join(", ")})입니다. 사용료·대부료의 120% 변상금 부과 대상이며 계속 점유하면 철거 등 조치도 가능합니다.`,
      articleIds: ["국유재산법-제72조", "국유재산법-제74조"],
    });
  }
  if (expiring.length > 0) {
    const first = expiring.sort((a, b) => a.d - b.d)[0];
    cautions.push({
      text: `[대부계약] ${first.r.parcel.지번 ? shortLot(first.r.parcel.지번) : ""} 계약이 ${first.l.계약종료일}에 끝납니다(D-${first.d}${expiring.length > 1 ? `, 만료 임박 ${expiring.length}건` : ""}). 갱신 신청은 대부기간 종료 1개월 전까지 해야 하고, 계약 조건 위반이 있으면 갱신할 수 없습니다.`,
      articleIds: ["국유재산법-제46조", "국유재산법 시행령-제50조"],
    });
  }
  if (cautions.length === 0) {
    cautions.push({ text: "[점검] 미납 변상금, 무계약 점유, 만료 임박 계약이 확인되지 않았습니다. 대부계약 이행 여부를 정기적으로 점검하세요.", articleIds: ["국유재산법-제47조"] });
  }

  // ---- 관리방안(규칙): 효율적인 순서 ----
  if (unpaid.length > 0) {
    plan.push({ text: "미납 변상금부터 납부를 독촉하고, 50만원 초과분은 분할납부를 안내한 뒤 체납 시 연체료·강제징수를 진행합니다.", articleIds: ["국유재산법 시행령-제71조", "국유재산법-제73조"] });
  }
  if (noLease.length > 0) {
    plan.push({ text: "무계약 점유 필지는 대부계약 체결 가능 여부를 먼저 보고, 어렵다면 점유 정리(철거 등)를 진행합니다.", articleIds: ["국유재산법-제72조", "국유재산법-제74조"] });
  }
  if (expiring.length > 0) {
    plan.push({ text: "만료 임박 계약은 종료 1개월 전까지 갱신 신청을 받고 갱신 불가 사유를 확인합니다.", articleIds: ["국유재산법-제46조", "국유재산법 시행령-제50조"] });
  }
  if (plan.length === 0) {
    plan.push({ text: "현재 대부계약이 정상 이행 중이므로 계약 종료 시점과 사용료 납부를 정기 점검합니다.", articleIds: ["국유재산법-제47조"] });
  }

  return { 이름: name, rows, totals, cautions, plan };
}

/** "대전광역시 동구 가양동 174-59" → "가양동 174-59" */
export function shortLot(addr: string): string {
  const m = addr.match(/(\S+[동리가읍면])\s+(산\s*)?(\d+(?:-\d+)?)$/);
  return m ? `${m[1]} ${m[2] ? "산 " : ""}${m[3]}` : addr;
}
