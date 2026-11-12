// Design Ref: §4 — 업무요강 별표 6의 "처분 승인권자 및 절차" 칸(부점장·검토위원회·감정평가·심의위원회·총괄청·국유심·국무회의)을
// HWP 표의 칸 좌표(열·행·병합)로 정확히 읽어 data/law/disposal.json 의 각 코드 조문에 붙인다.
// 실행: node scripts/merge-approval.mjs <표 json(extract-hwp-tables.mjs 결과)> [--dry]
import fs from "node:fs";

const [src, flag] = process.argv.slice(2);
const table = JSON.parse(fs.readFileSync(src, "utf8"));
const txt = (c) => c.text.map((s) => s.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

// 코드가 있는 칸(열 1)마다 한 항목. 한 항목 안에 "내용 칸(열 2)"이 여러 개이면(예: ※ 다만 면적 200㎡ 미만이면 심의 생략)
// 칸 묶음(block)마다 승인권자 표시가 따로 있다. 총괄청 칸(열 7)은 항목 전체에 걸쳐 하나다.
const codes = table.cells.filter((c) => c.col === 1 && c.row >= 2);
const records = codes.map((cc) => {
  const rows = [cc.row, cc.row + cc.rs - 1];
  const within = (c, r) => c.row >= r[0] && c.row <= r[1];
  const col = (n, r) => table.cells.filter((c) => c.col === n && within(c, r)).sort((x, y) => x.row - y.row);
  const descs = col(2, rows);
  const blocks = descs.map((d, i) => {
    const r = [d.row, d.row + d.rs - 1];
    const a5 = col(5, r), a6 = col(6, r);
    return {
      조건: i === 0 ? null : txt(d),
      부점장: col(3, r).map(txt).filter(Boolean),
      검토위원회: col(4, r).map(txt).filter(Boolean),
      심의: a5.map((c, k) => ({ 감정평가: txt(c), 심의위원회: a6[k] ? txt(a6[k]) : "" })),
      국유심: col(8, r).map(txt).filter(Boolean),
      국무회의: col(9, r).map(txt).filter(Boolean),
    };
  });
  return { 코드: txt(cc), 총괄청: col(7, rows).map(txt).filter(Boolean), blocks };
});

const or = (arr) => (arr.length ? arr.join(" ") : "표시 없음");
const blockLine = (b) =>
  [
    `부점장 ${or(b.부점장)}`,
    `검토위원회(내부) ${or(b.검토위원회)}`,
    b.심의.length ? "심의위원회(외부): " + b.심의.map((p) => `감정평가 ${p.감정평가 || "구간 표시 없음"} → ${p.심의위원회 || "표시 없음"}`).join(", ") : "심의위원회(외부) 표시 없음",
    `국유심 ${or(b.국유심)}`,
    `국무회의 및 국회 보고 ${or(b.국무회의)}`,
  ].join(" / ");
const line = (r) => {
  const head = `총괄청 ${or(r.총괄청)}`;
  if (r.blocks.length === 1) return `[승인권자·절차] ${blockLine(r.blocks[0])} / ${head}`;
  return (
    "[승인권자·절차] " +
    r.blocks.map((b, i) => `(${i === 0 ? "기본" : b.조건.replace(/^※\s*/, "").trim()}) ${blockLine(b)}`).join(" || ") +
    ` || ${head}`
  );
};

const dst = "data/law/disposal.json";
const d = JSON.parse(fs.readFileSync(dst, "utf8"));
let matched = 0;
const unmatched = [];
for (const r of records) {
  const art = d.articles.find((a) => a.조문번호 === r.코드);
  if (!art) {
    unmatched.push(r.코드);
    continue;
  }
  art.내용 = art.내용.replace(/\n?\[승인권자·절차\][^\n]*/g, "") + "\n" + line(r);
  art.승인권자 = { 총괄청: r.총괄청, 칸묶음: r.blocks };
  matched++;
}
console.log(`표의 코드 ${records.length}건 중 조문과 연결 ${matched}건, 연결 못한 코드: ${unmatched.join(", ") || "없음"}`);
const noArt = d.articles.filter((a) => /^\d/.test(a.조문번호) && !a.승인권자).map((a) => a.조문번호);
console.log(`승인권자 칸이 붙지 않은 조문: ${noArt.join(", ") || "없음"}`);
if (flag !== "--dry") {
  d.주의 = "수탁 국유일반재산 관리·처분 업무요강 별표 6(국유재산 처분승인기준) 표의 '처분 승인권자 및 절차' 칸은 HWP 표의 칸 좌표로 읽어 각 코드 조문의 내용 끝 [승인권자·절차]에 붙였다(2026-11-12). 삭제된 항목은 승인권자 칸이 없을 수 있다.";
  fs.writeFileSync(dst, JSON.stringify(d, null, 2) + "\n");
  console.log("저장:", dst);
}
