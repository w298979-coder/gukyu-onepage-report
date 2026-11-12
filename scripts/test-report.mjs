// 리포트용 글(lib/report.ts) 시험. 실행: node --no-warnings scripts/test-report.mjs
// 29건 모두에서 "undefined"·"null"·"NaN" 같은 깨진 값이 화면 글에 섞이지 않는지, 값이 없을 때 "해당 없음"이 나오는지 확인한다.
import fs from "node:fs";
import { complaintSummaryLine, oneLine, buildReport, NONE, fmtArea, fmtWon, pastHistory, priceHistory } from "../lib/report.ts";

const parcels = JSON.parse(fs.readFileSync("data/parcels.json", "utf8")).parcels;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "통과" : "실패"} | ${name}${detail ? " | " + detail : ""}`);
};

// 화면에 나오는 글(문자열 값)만 모아서 검사한다. 출처 칸이 비어 있다는 뜻의 null 값은 글이 아니므로 제외한다.
const strings = (v) => {
  const out = [];
  const walk = (x) => {
    if (typeof x === "string") out.push(x);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  walk(v);
  return out.join(" | ");
};
const BAD = /undefined|null|NaN|\[object/;

let badCount = 0;
let noneCount = 0;
for (const p of parcels) {
  const v = buildReport(p);
  const s = strings(v);
  if (BAD.test(s)) {
    badCount++;
    console.log("  깨진 값:", p.지번, s.match(BAD)[0]);
  }
  if (s.includes(NONE)) noneCount++;
}
check("29건 모두 리포트 글이 만들어지고 깨진 값이 없음", parcels.length === 29 && badCount === 0, `깨진 필지 ${badCount}건`);
check("값이 없는 항목은 '해당 없음'으로 표시됨", noneCount > 0, `${noneCount}건에서 사용`);

// 표기 규칙
check("면적은 ㎡ 단위로 표시", fmtArea(1931) === "1,931㎡" && fmtArea(null) === NONE);
check("금액은 원 단위로 표시", fmtWon(4975000) === "4,975,000원" && fmtWon(null) === NONE);

// 대표 사례
const by = (jibun) => parcels.find((p) => p.지번.endsWith(jibun));
const a = buildReport(by("가양동 174-59")); // 점유자 2명, 대부계약 2건
check("점유자 2명, 점유자별 대부계약이 연결됨", a.occupants.count === "2명" && a.occupants.summary.every((l) => l.includes("대부계약 1건")), a.occupants.summary[0]);
const b = buildReport(by("갈전동 산 50-3")); // 면적 포털 193, 브이월드 264
const area = b.basic.find((r) => r.label === "면적");
check("면적: 포털 값이 기본, 브이월드 필지 전체 면적이 함께 표시", area.value === "193㎡" && area.note.includes("264㎡") && area.source === "포털", area.note);
const c = buildReport(by("가수원동 547-35")); // 포털 면적 없음
const area2 = c.basic.find((r) => r.label === "면적");
check("포털 면적이 없으면 브이월드 값을 쓰고 출처를 표시", area2.value === "1,931㎡" && area2.source === "브이월드", area2.note);
const d = buildReport(by("가양동 598-11")); // 브이월드 토지특성 없음
const real = d.basic.find((r) => r.label === "실제지목");
check("브이월드 정보가 없으면 실제지목은 해당 없음(출처 표시 없음)", real.value === NONE && real.source === null);
const e = buildReport(by("가양동 153-6")); // 대부(입찰)검토: 점유자 없음
check("점유자가 없으면 '해당 없음'", e.occupants.summary[0] === NONE && e.occupants.count === NONE);
const f = buildReport(by("가양동 177-5")); // 무단점유: 변상금 3건
check("변상금은 건수와 미완납 표시", f.penalties.count.includes("3건") && f.penalties.count.includes("미완납"), f.penalties.count);
check("세 건을 넘으면 요약은 3건까지, 나머지는 추가사항 건수로", (() => { const big = buildReport({ ...by("가양동 177-5"), 변상금: Array.from({ length: 5 }, (_, k) => ({ ...by("가양동 177-5").변상금[0], id: "x" + k, 부과일: `2025-0${k + 1}-01` })) }); return big.penalties.summary.length === 3 && big.penalties.more === 2 && big.penalties.detail.length === 5 && big.penalties.summary[0].includes("2025-05-01"); })());


// 과거이력
const h1 = buildReport(by("가양동 177-5")); // 무단점유 중
check("무단점유 과거이력: 시작일과 '현재까지' 표시", h1.occupants.history[0].includes("현재까지"), h1.occupants.history[0]);
const h2 = buildReport(by("가양동 576-11")); // 대부계약 만료 후 무단점유 전환
check("대부계약 과거이력이 나온다", h2.leases.history[0] !== NONE && h2.leases.history[0].includes("만료"), h2.leases.history[0]);
const h3 = buildReport(by("가양동 174-59"));
check("공시지가 이력: 최근 연도가 먼저, 전년 대비 증감률 표시", h3.basicHistory[0].startsWith("2026년") && /전년 대비 [+-]\d/.test(h3.basicHistory[0]), h3.basicHistory[0]);
check("공시지가 이력의 마지막(가장 오래된 해)에는 증감률이 없다", !h3.basicHistory.at(-1).includes("전년 대비"), h3.basicHistory.at(-1));
check("공시지가 이력이 연도 수만큼 나온다", h3.basicHistory.length === 16, String(h3.basicHistory.length));
const h4 = buildReport(by("가양동 598-11")); // 공시지가 없음
check("공시지가가 없으면 이력은 해당 없음", h4.basicHistory[0] === NONE);
const noPast = { ...parcels[0], 과거이용: [] }; // 데이터에는 모든 필지에 이력이 있으므로 이력 없는 필지를 만들어 시험
check("해당 종류의 이력이 없으면 '해당 없음'", pastHistory(noPast, "무단점유").length === 1 && pastHistory(noPast, "무단점유")[0] === NONE, noPast.지번);
check("증감률 계산: 100→110은 +10.0%", priceHistory([{ 연도: 2024, 단가: 100 }, { 연도: 2025, 단가: 110 }])[0].includes("+10.0%") && priceHistory([{ 연도: 2024, 단가: 100 }, { 연도: 2025, 단가: 90 }])[0].includes("-10.0%"));
check("모든 카드에 과거이력 줄이 있다", parcels.every((p) => { const v = buildReport(p); return [v.occupants, v.leases, v.penalties, v.complaints].every((c) => c.history.length >= 1); }));

check("과거이력 건수: 이력이 있으면 1건 이상, 없으면 0", buildReport(by("가양동 177-5")).occupants.historyCount >= 1 && buildReport(by("가양동 576-11")).leases.historyCount >= 1 && h4.basicHistoryCount === 0);
check("29건 모두 변상금·민원 과거이력이 있다", parcels.every((p) => { const v = buildReport(p); return v.penalties.historyCount >= 1 && v.complaints.historyCount >= 1; }));

check("기본 정보에 개별공시지가·용도지역·지구가 들어 있고 기타 관리사항 항목은 없다", parcels.every((p) => { const v = buildReport(p); return v.basic.some((r) => r.label === "개별공시지가") && v.basic.some((r) => r.label === "용도지역·지구") && !("etc" in v); }));
check("29건 모두 현재 기준 변상금·민원이 있다(가상 데이터)", parcels.every((p) => p.변상금.length >= 1 && p.민원.length >= 1));
check("전 점유자의 변상금은 점유자 이름 대신 전 점유자로 표시", (() => { const q = parcels.find((p) => p.점유자.length === 0); return buildReport(q).penalties.summary[0].startsWith("전 점유자"); })());

const q = parcels.find((x) => x.지번.endsWith("가양동 174-7"));
const rq = buildReport(q);
check("가양동 174-7: 점유자 현빈, 대부계약은 해지, 변상금은 해지 이후 부과", q.점유자.length === 1 && q.점유자[0].이름 === "현빈" && q.대부계약[0].상태 === "해지" && q.변상금[0].점유자id === q.점유자[0].id && q.변상금[0].부과일 > q.대부계약[0].계약종료일, rq.penalties.summary[0]);
check("가양동 174-7의 변상금 줄에 점유자 이름이 나온다", rq.penalties.summary[0].startsWith("현빈"));

check("모든 점유자·민원인 이름이 전체 이름(가려지지 않음)이고 민원 줄에 민원인이 나온다", parcels.every((p) => p.점유자.every((o) => !o.이름.includes("○") && o.이름.length >= 2) && p.민원.every((c) => c.민원인 && !c.민원인.includes("○"))) && parcels.every((p) => buildReport(p).complaints.detail.every((l) => l === NONE || l.includes("민원인 ")) && buildReport(p).complaints.summary.every((l) => l === NONE || (l.split(" · ").length === 4 && !l.includes("\n")))));

check("oneLine: 긴 글은 …으로 줄이고 공백을 정리", oneLine("가".repeat(40), 10) === "가".repeat(9) + "…" && oneLine("  a   b \n c ") === "a b c");
check("민원 한 줄 요약은 내용·민원인·접수일·처리상태 순서", (() => { const q = parcels.find((x) => x.민원.length); const c = q.민원[0]; return complaintSummaryLine(c) === `${oneLine(c.내용)} · ${c.민원인} · ${c.접수일} · ${c.처리상태}`; })());

check("최근 것이 요약 앞에 온다(변상금 부과 최근순, 민원 접수 최근순)", parcels.every((p) => { const v = buildReport(p); const pd = p.변상금.map((x) => x.부과일).sort().reverse(); const cd = p.민원.map((c) => c.접수일).sort().reverse(); return (p.변상금.length === 0 || v.penalties.summary[0].includes(pd[0])) && (p.민원.length === 0 || v.complaints.summary[0].includes(cd[0])); }));
check("요약에 못 담은 건수(more)는 전체-3 이상일 때만", parcels.every((p) => { const v = buildReport(p); return v.penalties.more === Math.max(0, p.변상금.length - 3) && v.complaints.more === Math.max(0, p.민원.length - 3) && v.occupants.more === Math.max(0, p.점유자.length - 3) && v.leases.more === Math.max(0, p.대부계약.length - 3); }));

console.log(failed === 0 ? "\n모든 시험 통과" : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
