// Design Ref: §3.1 — 포털 + 브이월드 + 가상 데이터를 합쳐 앱이 읽는 data/parcels.json 을 만든다.
// Plan: 작업 3 (가상 데이터 작성). 형식은 lib/types.ts 와 같다.
//
// 가상 데이터(점유자·대부계약·변상금·민원·기타 관리사항·과거이용)는 실존 인물·사건과 무관하다.
// 포털 상태와 앞뒤가 맞게 만들고, 번호 기반 고정 규칙을 써서 실행할 때마다 같은 결과가 나온다.
//
// 실행: node scripts/build-parcel-data.mjs
import { readFile, writeFile } from "node:fs/promises";

const portal = JSON.parse(await readFile("data/portal-parcels.json", "utf8")).parcels;
const vworld = JSON.parse(await readFile("data/vworld-parcels.json", "utf8")).parcels;

const TODAY = "2026-11-12"; // 문서 작성일 기준(현재 시점)

/** 번호로부터 같은 숫자열을 만드는 간단한 난수(실행마다 결과가 달라지지 않게). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["김○○", "이○○", "박○○", "최○○", "정○○", "강○○", "조○○", "윤○○", "장○○", "임○○", "한○○", "오○○"];
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const addYears = (s, n) => iso(Number(s.slice(0, 4)) + n, Number(s.slice(5, 7)), Number(s.slice(8, 10)));
const round1000 = (n) => Math.round(n / 1000) * 1000;

/** 필드 만들기 */
const field = (value, source, alt) => (alt ? { value, source, alt } : { value, source });

function mergeBasic(p, v) {
  const t = v.특성;
  const vArea = t?.면적 ?? null;
  // 면적: 포털(국유재산 면적)이 기본, 브이월드(필지 전체 면적)는 값이 다를 때 alt
  let 면적;
  if (p.면적 !== null && p.면적 !== undefined) {
    면적 = vArea !== null && vArea !== p.면적 ? field(p.면적, "포털", { value: vArea, source: "브이월드" }) : field(p.면적, "포털");
  } else {
    면적 = field(vArea, vArea !== null ? "브이월드" : "포털");
  }
  // 지목: 브이월드 기준, 없으면 포털
  const vJimok = t?.지목 ?? null;
  const pJimok = p.지목 || null;
  const 지목 =
    vJimok !== null
      ? field(vJimok, "브이월드", pJimok !== null && pJimok !== vJimok ? { value: pJimok, source: "포털" } : undefined)
      : field(pJimok, "포털");
  const 실제지목 = field(t?.이용상황 ?? null, "브이월드");
  const 공시지가 = field(v.공시지가.length ? v.공시지가 : null, "브이월드");
  const 용도지역 = field(v.용도지역.length ? v.용도지역 : null, "브이월드");
  return { 면적, 지목, 실제지목, 공시지가, 용도지역 };
}

const latestPrice = (v) => (v.공시지가.length ? v.공시지가[v.공시지가.length - 1].단가 : null);

/** 가상 점유자·계약·변상금·민원·메모·과거이용을 상태에 맞게 만든다. */
function makeVirtual(p, v, i, area) {
  const r = rng(i + 1);
  const pid = v.pnu ?? `portal-${i}`;
  const price = latestPrice(v) ?? 500000;
  const nameAt = (k) => NAMES[(i * 3 + k) % NAMES.length];
  const out = { 점유자: [], 대부계약: [], 변상금: [], 민원: [], 과거이용: [], 메모: "" };

  const occupant = (k, share, startYear, note) => {
    const a = area ?? 0;
    return {
      id: `${pid}-o${k}`,
      이름: nameAt(k),
      점유면적: a ? Math.max(1, Math.round(a * share * 10) / 10) : null,
      점유시작일: iso(startYear, 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)),
      비고: note ?? "가상 데이터",
    };
  };
  const lease = (occ, startYear, years, status) => {
    const start = iso(startYear, 1 + Math.floor(r() * 12), 1);
    return {
      id: `${occ.id.replace("-o", "-l")}`,
      점유자id: occ.id,
      계약시작일: start,
      계약종료일: addYears(start, years),
      연사용료: area ? round1000(price * Math.max(1, (occ.점유면적 ?? area)) * 0.05) : null,
      상태: status,
    };
  };
  let penaltySeq = 0;
  const penalty = (occ, year, status, months) => ({
    id: `${occ.id.replace("-o", "-p")}-${++penaltySeq}`,
    점유자id: occ.id,
    부과일: iso(year, 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)),
    금액: area ? round1000(price * Math.max(1, occ.점유면적 ?? area) * 0.1 * (months / 12)) : null,
    납부상태: status,
  });
  const complaint = (k, y, text, status) => ({
    id: `${pid}-c${k}`,
    접수일: iso(y, 1 + Math.floor(r() * 12), 1 + Math.floor(r() * 28)),
    내용: text,
    처리상태: status,
  });

  switch (p.상태) {
    case "사용중인재산(대부/수의)": {
      const two = i % 3 === 0; // 일부 필지는 점유자 2명(점유자별 대부계약 확인용)
      const o1 = occupant(1, two ? 0.6 : 0.95, 2021 + (i % 3));
      out.점유자.push(o1);
      out.대부계약.push(lease(o1, 2023 + (i % 3), 5, "유효"));
      if (two) {
        const o2 = occupant(2, 0.35, 2024);
        out.점유자.push(o2);
        out.대부계약.push(lease(o2, 2024, 3, "유효"));
      }
      out.과거이용.push({ 종류: "대부계약", 시작일: iso(2016 + (i % 3), 3, 1), 종료일: iso(2021 + (i % 3), 2, 28), 내용: "이전 대부계약(만료), 이후 재계약" });
      if (i === 3) out.변상금.push(penalty(o1, Number(o1.점유시작일.slice(0, 4)), "완납", 12)); // 대부계약 전 무단 사용 기간의 변상금(완납)
      if (i % 4 === 1) out.민원.push(complaint(1, 2025, "대부료 산정 방식 문의", "완료"));
      out.메모 = "대부계약 유지 중. 계약 종료 시기와 사용료 조정 시점을 확인할 것.";
      break;
    }
    case "사용중인재산(무단점유)": {
      const o1 = occupant(1, 0.9, 2018 + (i % 4), "무단점유(가상)");
      out.점유자.push(o1);
      if (i % 2 === 0) {
        const o2 = occupant(2, 0.1, 2022, "무단점유(가상)");
        out.점유자.push(o2);
        out.변상금.push(penalty(o2, 2025, "미납", 12));
      }
      out.변상금.push(penalty(o1, 2025, i === 13 ? "완납" : i % 3 === 0 ? "일부납부" : "미납", 12));
      out.변상금.push(penalty(o1, 2024, "완납", 12));
      out.민원.push(complaint(1, 2025, "무단 경작·적치물 관련 신고", i % 2 ? "처리중" : "완료"));
      if (i % 2 === 0) out.민원.push(complaint(2, 2026, "점유자 변경 여부 확인 요청", "접수"));
      if (i === 10) out.과거이용.push({ 종류: "대부계약", 시작일: iso(2014, 5, 1), 종료일: iso(2019, 4, 30), 내용: "대부계약 만료 후 갱신 없이 계속 사용(무단점유로 전환)" });
      out.과거이용.push({ 종류: "무단점유", 시작일: o1.점유시작일, 종료일: null, 내용: "무단점유 시작, 현재까지 계속" });
      out.메모 = "무단점유 중. 변상금 부과·납부 현황과 점유 정리 방향을 확인할 것.";
      break;
    }
    case "대부(입찰)검토재산": {
      if (i % 2 === 0) out.과거이용.push({ 종류: "대부계약", 시작일: iso(2017, 6, 1), 종료일: iso(2022, 5, 31), 내용: "이전 대부계약 만료 후 사용자 없음" });
      if (i % 3 === 0) out.과거이용.push({ 종류: "무단점유", 시작일: iso(2019, 3, 1), 종료일: iso(2023, 8, 31), 내용: "무단점유 정리 후 반환" });
      if (i === 17) out.민원.push(complaint(1, 2026, "방치로 인한 환경 정비 요청", "처리중"));
      out.메모 = "현재 사용자 없음(미활용). 대부입찰 또는 매각입찰 검토 대상.";
      break;
    }
    case "매각제한재산": {
      const jimok = p.지목 || v.특성?.지목 || "";
      const kind = ["도로", "제방", "구거", "묘지"].includes(jimok) ? "공공용·특수 용도 재산 성격(가상 설명)" : "매각 제한 사유 확인 필요(가상 설명)";
      if (i === 23) {
        const o1 = occupant(1, 0.5, 2020, "가상 데이터");
        out.점유자.push(o1);
        out.대부계약.push(lease(o1, 2024, 3, "유효"));
      }
      if (i === 21) out.민원.push(complaint(1, 2025, "통행 방해 민원", "완료"));
      if (i === 26) out.과거이용.push({ 종류: "무단점유", 시작일: iso(2017, 2, 1), 종료일: iso(2021, 10, 31), 내용: "무단점유 정리 완료" });
      out.메모 = `매각제한재산. ${kind}. 제한 사유와 대부 가능 여부를 근거와 함께 확인할 것.`;
      break;
    }
    case "사용중인재산(대부/입찰)": {
      const o1 = occupant(1, 0.95, 2025, "입찰 낙찰 후 사용(가상)");
      out.점유자.push(o1);
      out.대부계약.push(lease(o1, 2025, 5, "유효"));
      out.과거이용.push({ 종류: "무단점유", 시작일: iso(2020, 4, 1), 종료일: iso(2024, 12, 31), 내용: "무단점유 정리 후 입찰 진행" });
      out.메모 = "입찰로 대부계약 체결. 계약 이행 여부와 종료 시 재입찰·처분 방향을 확인할 것.";
      break;
    }
    default:
      throw new Error(`알 수 없는 상태: ${p.상태}`);
  }
  return { pid, ...out };
}

const parcels = portal.map((p, i) => {
  const v = vworld[i];
  if (v.지번 !== p.지번) throw new Error(`순서 불일치: ${p.지번} / ${v.지번}`);
  const basic = mergeBasic(p, v);
  const area = basic.면적.value;
  const g = makeVirtual(p, v, i, area);
  return {
    id: g.pid,
    지번: p.지번,
    구분: p.구분,
    상태: p.상태,
    ...basic,
    점유자: g.점유자,
    대부계약: g.대부계약,
    변상금: g.변상금,
    민원: g.민원,
    기타관리사항: field(g.메모, "가상"),
    과거이용: g.과거이용,
  };
});

// ---- 검증: 형식과 앞뒤 일관성 ----
const problems = [];
const STATUSES = new Set(["사용중인재산(대부/수의)", "사용중인재산(무단점유)", "대부(입찰)검토재산", "매각제한재산", "사용중인재산(대부/입찰)"]);
const ids = new Set();
for (const p of parcels) {
  if (ids.has(p.id)) problems.push(`${p.지번}: id 중복`);
  ids.add(p.id);
  if (!STATUSES.has(p.상태)) problems.push(`${p.지번}: 알 수 없는 상태`);
  if (p.구분 !== "토지") problems.push(`${p.지번}: 구분이 토지가 아님`);
  const occIds = new Set(p.점유자.map((o) => o.id));
  for (const l of p.대부계약) if (!occIds.has(l.점유자id)) problems.push(`${p.지번}: 대부계약의 점유자 없음`);
  for (const x of p.변상금) if (!occIds.has(x.점유자id)) problems.push(`${p.지번}: 변상금의 점유자 없음`);
  for (const o of p.점유자) if (!/○/.test(o.이름)) problems.push(`${p.지번}: 점유자 이름이 가려지지 않음`);
  const childIds = [...p.점유자, ...p.대부계약, ...p.변상금, ...p.민원].map((x) => x.id);
  if (new Set(childIds).size !== childIds.length) problems.push(`${p.지번}: 점유자·계약·변상금·민원 id 중복`);
  for (const x of p.변상금) {
    const occ = p.점유자.find((o) => o.id === x.점유자id);
    if (occ && x.부과일.slice(0, 4) < occ.점유시작일.slice(0, 4)) problems.push(`${p.지번}: 변상금 부과일이 점유 시작보다 빠름`);
  }
  if (p.상태 === "대부(입찰)검토재산" && (p.점유자.length || p.대부계약.length)) problems.push(`${p.지번}: 검토재산인데 점유자/계약이 있음`);
  if (p.상태 === "사용중인재산(무단점유)" && p.대부계약.length) problems.push(`${p.지번}: 무단점유인데 대부계약이 있음`);
  if (p.상태 === "사용중인재산(대부/수의)" && !p.대부계약.some((l) => l.상태 === "유효")) problems.push(`${p.지번}: 대부 재산인데 유효 계약 없음`);
  for (const l of p.대부계약) if (l.상태 === "유효" && l.계약종료일 <= TODAY) problems.push(`${p.지번}: 유효 계약이 이미 종료일 지남`);
}
if (problems.length) {
  console.error("검증 실패:\n - " + problems.join("\n - "));
  process.exit(1);
}

const out = {
  _source: "필지 목록: 캠코 국유재산포털. 토지 정보: 브이월드. 점유자·대부계약·변상금·민원·기타 관리사항·과거이용: 실습용 가상 데이터(실존 인물·사건과 무관).",
  _generatedFor: TODAY,
  parcels,
};
await writeFile("data/parcels.json", JSON.stringify(out, null, 2) + "\n", "utf8");

const count = (f) => parcels.reduce((a, p) => a + f(p), 0);
console.log(`저장: data/parcels.json (${parcels.length}건)`);
console.log(`점유자 ${count((p) => p.점유자.length)}명, 대부계약 ${count((p) => p.대부계약.length)}건, 변상금 ${count((p) => p.변상금.length)}건, 민원 ${count((p) => p.민원.length)}건, 과거이용 ${count((p) => p.과거이용.length)}건`);
console.log("검증 통과");
