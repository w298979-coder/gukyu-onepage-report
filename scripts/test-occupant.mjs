// 점유자별 리포트(lib/occupant-core.ts) 시험. 실행: node --no-warnings scripts/test-occupant.mjs
import fs from "node:fs";
import { buildOccupantReport, listOccupants, shortLot } from "../lib/occupant-core.ts";

const parcels = JSON.parse(fs.readFileSync("data/parcels.json", "utf8")).parcels;
const lawIds = new Set(["act", "decree", "rule", "farmland", "sechik", "yogang", "disposal"].flatMap((f) => JSON.parse(fs.readFileSync(`data/law/${f}.json`, "utf8")).articles).map((a) => a.id));
const TODAY = "2026-11-12";
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "통과" : "실패"} | ${name}${detail ? " | " + detail : ""}`);
};

const list = listOccupants(parcels);
const occCount = parcels.reduce((a, p) => a + p.점유자.length, 0);
check("목록의 필지 수 합계가 점유자 수와 같다", list.reduce((a, x) => a + x.필지수, 0) === occCount, `${list.length}명 / ${occCount}`);
check("필지 수가 많은 순으로 정렬", list.every((x, i) => i === 0 || list[i - 1].필지수 >= x.필지수));
check("점유자마다 리포트가 만들어진다", list.every((x) => buildOccupantReport(parcels, x.이름, TODAY) !== null));
check("없는 이름은 null", buildOccupantReport(parcels, "없는사람", TODAY) === null);

const reports = list.map((x) => buildOccupantReport(parcels, x.이름, TODAY));
check("대부계약·변상금 건수가 필지별 자료와 일치", reports.every((r) => r.totals.validLeases === r.rows.flatMap((x) => x.leases).filter((l) => l.상태 === "유효").length && r.totals.penalties === r.rows.reduce((a, x) => a + x.penalties.length, 0)));
check("점유 필지 수·면적 합계", reports.every((r) => r.totals.parcels === r.rows.length && Math.abs(r.totals.area - r.rows.reduce((a, x) => a + (x.occupant.점유면적 ?? 0), 0)) < 1e-6));
check("미납 합계는 미납·일부납부 변상금의 금액 합", reports.every((r) => r.totals.unpaidAmount === r.rows.flatMap((x) => x.penalties).filter((p) => p.납부상태 !== "완납").reduce((a, p) => a + (p.금액 ?? 0), 0)));
check("모든 주의사항·관리방안에 근거 조문이 있고 저장된 조문이다", reports.every((r) => [...r.cautions, ...r.plan].every((s) => s.articleIds.length > 0 && s.articleIds.every((id) => lawIds.has(id)))));
check("관리방안은 3개 이하", reports.every((r) => r.plan.length >= 1 && r.plan.length <= 3));
check("미납 변상금이 있으면 주의사항에 변상금 문장이 있다", reports.every((r) => r.totals.unpaidCount === 0 || r.cautions.some((c) => c.text.startsWith("[변상금]"))));
check("유효 계약 없는 점유가 있으면 주의사항에 점유 문장이 있다", reports.every((r) => !r.rows.some((x) => x.noValidLease) || r.cautions.some((c) => c.text.startsWith("[점유]"))));

// 만료 임박(가짜 날짜로)
const fake = JSON.parse(JSON.stringify(parcels));
const target = fake.find((p) => p.대부계약.some((l) => l.상태 === "유효"));
const lease = target.대부계약.find((l) => l.상태 === "유효");
lease.계약종료일 = "2027-01-10";
const name = target.점유자.find((o) => o.id === lease.점유자id).이름;
const r2 = buildOccupantReport(fake, name, TODAY);
check("만료 임박 계약은 D-일수와 함께 주의사항에 나온다", r2.cautions.some((c) => c.text.startsWith("[대부계약]") && c.text.includes("D-59")), r2.cautions.map((c) => c.text.slice(0, 40)).join(" | "));
lease.계약종료일 = "2030-01-10";
const r3 = buildOccupantReport(fake, name, TODAY);
check("만료가 멀면 만료 임박 문장이 없다", !r3.cautions.some((c) => c.text.startsWith("[대부계약]")));
check("지번 줄임", shortLot("대전광역시 동구 가양동 174-59") === "가양동 174-59" && shortLot("대전광역시 대덕구 갈전동 산 50-3") === "갈전동 산 50-3");

console.log(failed === 0 ? "\n모든 시험 통과" : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
