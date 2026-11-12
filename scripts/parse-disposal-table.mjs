// Design Ref: §4 — 업무요강 [별표 6] 국유재산 처분승인기준(표)을 코드별 항목으로 저장한다.
// Plan: 작업 4. 한글 표는 칸마다 한 줄씩 풀려 추출되므로, 승인권자 표시 칸(O/X, 금액 구간)은 믿을 수 없어 저장하지 않고
// 처분 유형별 기준 설명(내용 칸)과 별표 앞부분의 승인·심의 대상 설명 글만 저장한다.
//
// 실행: node scripts/parse-disposal-table.mjs <요강 텍스트 파일> <출력 json>
import fs from "node:fs";

const [src, dst] = process.argv.slice(2);
if (!src || !dst) {
  console.error("사용법: node scripts/parse-disposal-table.mjs <txt> <out.json>");
  process.exit(1);
}

const 문서명 = "수탁 국유일반재산 관리·처분 업무요강 별표 6(국유재산 처분승인기준)";
const 출처주소 = "https://www.kamco.or.kr/portal/bbs/view.do?mId=0601070100&bIdx=26366&ptIdx=270";

const lines = fs.readFileSync(src, "utf8").split("\n").map((l) => l.trim());
const start = lines.findIndex((l) => l.startsWith("[별표 6]"));
const end = lines.findIndex((l, i) => i > start && l.startsWith("[별표 7]"));
if (start < 0 || end < 0) throw new Error("별표 6 범위를 찾지 못함");
const block = lines.slice(start, end).filter(Boolean);

// 1) 앞부분 설명(근거, 총괄청 승인사항, 검토위원회·심의위원회 심의대상)
const flowAt = block.findIndex((l) => l === "부점장");
const head = block.slice(0, flowAt > 0 ? flowAt : 30).filter((l) => !/^-\s+-$/.test(l));

const articles = [];
articles.push({
  id: `${문서명}-승인·심의 대상`,
  문서명,
  조문번호: "승인·심의 대상",
  제목: "총괄청 승인사항, 검토위원회·심의위원회 심의대상",
  내용: head.join("\n"),
  출처주소,
});

// 2) 처분승인기준 표: [구분] [코드] [내용 ...] 순서로 풀려 있다
const tableAt = block.findIndex((l) => l === "처분승인기준 내용");
const rows = [];
let cur = null;
const cats = new Set(["매각", "교환", "양여", "신탁", "현물출자", "대부", "기타", "관리전환", "개발", "출자", "무상귀속"]);
const codeRe = /^\d+(-\d+)+(\([가-힣]\)|-[가-힣])?$/;
const body = block.slice(tableAt + 1);
for (let i = 0; i < body.length; i++) {
  const l = body[i];
  if (cats.has(l) && codeRe.test(body[i + 1] ?? "")) {
    cur = { cat: l, code: null, lines: [] };
    rows.push(cur);
    continue;
  }
  if (!cur) continue;
  if (!cur.code && codeRe.test(l)) {
    cur.code = l;
    continue;
  }
  cur.lines.push(l);
}

// 표 칸 조각(승인권자 O/X, 금액 구간 등)은 내용에서 뺀다
const isCell = (l) =>
  /^(O|X|○|×|△|-)$/.test(l) ||
  (l.length < 45 && /^(감정가|대장가|10억|50억|300억|100억|500억|일단의 면적|\(일단의|\(처분기준\)|부점장|검토위원회|감정평가|심의위원회|총괄청|국유심|국무회의)/.test(l));

let skipped = 0;
for (const r of rows) {
  const content = r.lines.filter((l) => !isCell(l));
  skipped += r.lines.length - content.length;
  const text = content.join("\n").trim();
  if (!text || /^삭제/.test(text)) continue; // 삭제된 기준은 저장하지 않는다
  articles.push({
    id: `${문서명}-${r.code}`,
    문서명,
    조문번호: r.code,
    제목: `${r.cat} 처분승인기준`,
    내용: `${r.code} ${text}`,
    출처주소,
  });
}

const out = {
  문서명,
  시행일: "2026-01-28",
  출처: "알리오가 아닌 한국자산관리공사 홈페이지 현행내규 첨부파일(수탁 국유일반재산 관리·처분 업무요강 전문, 2026.1.28. 시행) [별표 6]",
  조회일: "2026-11-12",
  주의: "표의 승인권자·금액 구간 칸(O/X 등)은 추출 순서가 불분명해 저장하지 않았다. 승인권자는 '승인·심의 대상' 항목과 원문 표로 확인해야 한다.",
  조문수: articles.length,
  articles,
};
fs.writeFileSync(dst, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`${문서명}: 항목 ${articles.length}개 저장 (표 행 ${rows.length}개, 칸 조각 ${skipped}줄 제외) → ${dst}`);
