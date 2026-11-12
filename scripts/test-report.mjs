// 리포트용 글(lib/report.ts) 시험. 실행: node --no-warnings scripts/test-report.mjs
// 29건 모두에서 "undefined"·"null"·"NaN" 같은 깨진 값이 화면 글에 섞이지 않는지, 값이 없을 때 "해당 없음"이 나오는지 확인한다.
import fs from "node:fs";
import { buildReport, NONE, fmtArea, fmtWon } from "../lib/report.ts";

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
check("세 건을 넘으면 '외 N건' 안내", buildReport({ ...by("가양동 177-5"), 변상금: Array.from({ length: 5 }, (_, i) => ({ ...by("가양동 177-5").변상금[0], id: "x" + i })) }).penalties.summary.some((l) => l.startsWith("외 2건")));

console.log(failed === 0 ? "\n모든 시험 통과" : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
