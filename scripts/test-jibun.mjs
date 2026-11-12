// 지번 정리·검색(lib/jibun.ts) 시험. 실행: node scripts/test-jibun.mjs
// Node의 타입 제거 기능으로 .ts 파일을 그대로 불러온다.
import fs from "node:fs";
import { parseJibun, findParcels, parseParcelAddress, MAX_INPUT_LENGTH } from "../lib/jibun.ts";

const parcels = JSON.parse(fs.readFileSync("data/parcels.json", "utf8")).parcels;
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "통과" : "실패"} | ${name}${detail ? " | " + detail : ""}`);
};
const q = (s) => {
  const r = parseJibun(s);
  return r.ok ? r.query : null;
};
// 구는 동을 더 좁혀 주는 정보일 뿐이라 표기 통일 비교에서는 뺀다
const key = (x) => (x ? `${x.dong ?? "*"}/${x.san ? "산" : "-"}${x.main}-${x.sub}` : "오류");

// 1) 같은 지번의 여러 표기가 같은 결과가 되는지
const same = [
  ["가양동 174-59", "가양동174-59", "가양동 174번지 59", "가양동 174의 59", "가양동 174 - 59", "동구 가양동 174-59", "대전광역시 동구 가양동 174-59", "대전 동구 가양동 174–59"],
  ["갈전동 산 50-3", "갈전동 산50-3", "갈전동 산50번지3", "갈전동 산 50번지 3", "대덕구 갈전동 산50의3"],
  ["갈전동 476", "갈전동 476번지", "갈전동476", "갈전동 476-0"],
];
for (const group of same) {
  const keys = new Set(group.map((s) => key(q(s))));
  check(`표기 통일: ${group[0]} 외 ${group.length - 1}개`, keys.size === 1 && !keys.has("오류"), [...keys].join(" , "));
}

// 2) 잘못된 입력은 이유와 함께 거절되는지
const bad = ["", "   ", "가양동", "abc", "174-59-3", "서울특별시 강남구 개포동 95-17", "가양동 12 34", "a".repeat(MAX_INPUT_LENGTH + 1), "가양동 <script>1</script>"];
for (const s of bad) {
  const r = parseJibun(s);
  check(`거절: ${JSON.stringify(s.slice(0, 20))}`, !r.ok, r.ok ? key(r.query) : r.reason);
}

// 3) 저장된 필지 29건 모두: 전체 주소·짧은 주소로 정확히 자기 자신 하나만 찾아지는지
check("필지 수 29건", parcels.length === 29, String(parcels.length));
for (const p of parcels) {
  const a = parseParcelAddress(p.지번);
  const full = findParcels(q(p.지번), parcels);
  const short = findParcels(q(`${a.dong} ${a.san ? "산 " : ""}${a.main}${a.sub ? "-" + a.sub : ""}`), parcels);
  const ok = full.length === 1 && full[0].id === p.id && short.length >= 1 && short.some((x) => x.id === p.id);
  if (!ok || short.length > 1) check(`필지 조회: ${p.지번}`, ok, `전체 ${full.length}건, 짧은 표기 ${short.length}건`);
}
check("필지 29건 전체 주소 조회가 모두 1건씩 일치", parcels.every((p) => findParcels(q(p.지번), parcels).length === 1));

// 4) 없는 지번, 동 불일치, 산 여부 불일치
check("없는 지번 → 0건", findParcels(q("가양동 9999-1"), parcels).length === 0);
check("동이 다르면 0건 (가수원동 174-59)", findParcels(q("가수원동 174-59"), parcels).length === 0);
check("산 여부가 다르면 0건 (갈전동 50-3)", findParcels(q("갈전동 50-3"), parcels).length === 0);
check("번호만 입력해도 찾는다 (174-59)", findParcels(q("174-59"), parcels).length >= 1);

// 5-1) 같은 번호가 여러 동에 있는 경우를 가짜 데이터로 시험
const fake = [{ ...parcels[0], id: "fake-1", 지번: "대전광역시 서구 가수원동 174-59" }, ...parcels];
check("번호만 입력하면 여러 건(동 구분 없음)", findParcels(q("174-59"), fake).length === 2);
check("동을 적으면 1건으로 좁혀진다", findParcels(q("가수원동 174-59"), fake).length === 1 && findParcels(q("서구 가양동 174-59"), fake).length === 0);

// 5) 같은 번호가 여러 건이면 선택 목록이 나오는지(데이터에 중복이 있는 경우)
const byNumber = new Map();
for (const p of parcels) {
  const a = parseParcelAddress(p.지번);
  const k = `${a.san}-${a.main}-${a.sub}`;
  byNumber.set(k, (byNumber.get(k) ?? 0) + 1);
}
const dup = [...byNumber.values()].filter((n) => n > 1).length;
console.log(`참고: 번호만 같은 필지 묶음 ${dup}개 (동 이름 없이 입력하면 여러 건이 나올 수 있음)`);

console.log(failed === 0 ? "\n모든 시험 통과" : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
