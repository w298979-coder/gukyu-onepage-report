// Design Ref: §4 — 규정 본문 텍스트(.txt)를 조문 단위 JSON(data/law/*.json)으로 바꾼다.
// Plan: 작업 4. 알리오에서 받은 한글(.hwp) 파일은 scripts/extract-hwp.mjs 로 먼저 텍스트로 뽑는다.
//
// 실행: node scripts/parse-rule-text.mjs <텍스트 파일> <문서명> <출력 json> <출처 주소> <시행일(YYYY-MM-DD)> <파일명 설명>
import fs from "node:fs";

const [src, 문서명, dst, 출처주소, 시행일, 파일설명] = process.argv.slice(2);
if (!src || !문서명 || !dst || !출처주소) {
  console.error("사용법: node scripts/parse-rule-text.mjs <txt> <문서명> <out.json> <출처 주소> <시행일> <파일명 설명>");
  process.exit(1);
}

const lines = fs
  .readFileSync(src, "utf8")
  .split("\n")
  .map((l) => l.replace(/\s+$/, ""));

const re = /^\s*제(\d+)조(?:의(\d+))?\(([^)]{1,60})\)/;
const heads = [];
lines.forEach((l, i) => {
  const m = l.match(re);
  if (m) heads.push({ i, n: Number(m[1]), sub: m[2] ? Number(m[2]) : 0, title: m[3] });
});

// 번호가 크게 되돌아가는 지점부터는 부칙·별표로 보고 제외한다
let end = heads.length;
for (let k = 1; k < heads.length; k++) {
  if (heads[k].n < heads[k - 1].n - 5) {
    end = k;
    break;
  }
}

const seen = new Set();
const articles = [];
for (let k = 0; k < end; k++) {
  const h = heads[k];
  const next = k + 1 < heads.length ? heads[k + 1].i : lines.length;
  const body = lines
    .slice(h.i, next)
    .map((l) => l.trim())
    .filter((l) => l && !/^제\d+(장|절|관)\s/.test(l) && !/^\[별표|^\[서식/.test(l))
    .join("\n");
  const 조문번호 = `제${h.n}조${h.sub ? `의${h.sub}` : ""}`;
  if (seen.has(조문번호)) continue;
  seen.add(조문번호);
  articles.push({
    id: `${문서명}-${조문번호}`,
    문서명,
    조문번호,
    제목: h.title,
    내용: body,
    출처주소,
  });
}

const out = {
  문서명,
  시행일,
  출처: `알리오(ALIO) 한국자산관리공사 내부규정 첨부파일: ${파일설명}`,
  조회일: "2026-11-12",
  조문수: articles.length,
  articles,
};
fs.writeFileSync(dst, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`${문서명}: 조문 ${articles.length}개 저장 (${dst})`);
