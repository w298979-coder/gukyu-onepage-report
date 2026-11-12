// 수정·추가 저장 로직(lib/edits.ts) 시험. 실행: node --no-warnings scripts/test-edits.mjs
import { addEdit, editHistoryLines, getEdits, parseStore, validateEdit, MAX_TEXT } from "../lib/edits.ts";

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "통과" : "실패"} | ${name}${detail ? " | " + detail : ""}`);
};

check("빈 값·깨진 글은 빈 저장소", Object.keys(parseStore("")).length === 0 && Object.keys(parseStore("{깨짐")).length === 0 && Object.keys(parseStore("[1]")).length === 0);
check("모양이 다른 기록은 버린다", Object.keys(parseStore(JSON.stringify({ a: { 민원: [{ 값: 1 }] } }))).length === 0);

check("수정자 이름이 없으면 거절", !validateEdit("내용", "  ").ok);
check("내용이 없으면 거절", !validateEdit("   ", "홍길동").ok);
check("내용이 너무 길면 거절", !validateEdit("가".repeat(MAX_TEXT + 1), "홍").ok);
check("정상 입력은 앞뒤 공백을 지운다", (() => { const r = validateEdit(" 메모 ", " 담당자 "); return r.ok && r.값 === "메모" && r.수정자 === "담당자"; })());

let s = {};
s = addEdit(s, "p1", "민원", { 값: "첫 수정", 수정자: "가", 수정시각: "2026-01-01T00:00:00.000Z" });
const before = JSON.stringify(s);
const s2 = addEdit(s, "p1", "민원", { 값: "두 번째", 수정자: "나", 수정시각: "2026-02-01T00:00:00.000Z" });
check("원본 저장소는 바뀌지 않는다", JSON.stringify(s) === before);
check("수정하면 이전 값이 남고 마지막이 현재 값", getEdits(s2, "p1", "민원").length === 2 && getEdits(s2, "p1", "민원").at(-1).값 === "두 번째");
check("다른 필지·항목에는 영향이 없다", getEdits(s2, "p2", "민원").length === 0 && getEdits(s2, "p1", "변상금").length === 0);
check("저장했다가 다시 읽어도 같다", getEdits(parseStore(JSON.stringify(s2)), "p1", "민원").length === 2);
const lines = editHistoryLines(getEdits(s2, "p1", "민원"));
check("수정 기록은 최근 것이 먼저, 현재 값 표시", lines[0].includes("두 번째") && lines[0].includes("(현재 값)") && lines[1].includes("첫 수정") && lines[1].includes("수정자 가"), lines[0]);

console.log(failed === 0 ? "\n모든 시험 통과" : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
