// HWP(5.x) 본문의 표를 칸 좌표(열·행·병합)와 함께 읽는다(읽기 전용). 사용: node scripts/extract-hwp-tables.mjs  (입력 파일 경로는 아래 상수)
// 필요한 도구: cfb(프로젝트에는 설치하지 않음. 별도 폴더에 npm i cfb 후 이 파일을 복사해 실행). 결과 b6table.json 은 scripts/merge-approval.mjs 의 입력이다.
import fs from "node:fs";
import zlib from "node:zlib";
import CFB from "cfb";
const buf = fs.readFileSync("../dl-yogang/file.bin");
const cfb = CFB.read(buf, { type: "buffer" });
const flags = CFB.find(cfb, "FileHeader").content.readUInt32LE(36);
const compressed = (flags & 1) !== 0;
const sections = cfb.FullPaths.filter((p) => /BodyText\/Section\d+$/.test(p)).sort((a, b) => Number(a.match(/\d+$/)) - Number(b.match(/\d+$/)));
const EXT = new Set([1,2,3,4,5,6,7,8,11,12,14,15,16,17,18,19,20,21,22,23]);
const tables = [];
let cur = null, cell = null;
for (const p of sections) {
  let data = Buffer.from(CFB.find(cfb, p).content);
  if (compressed) data = zlib.inflateRawSync(data);
  let off = 0;
  while (off + 4 <= data.length) {
    const h = data.readUInt32LE(off); off += 4;
    const tag = h & 0x3ff; const level = (h >>> 10) & 0x3ff;
    let size = (h >>> 20) & 0xfff;
    if (size === 0xfff) { size = data.readUInt32LE(off); off += 4; }
    const rec = data.subarray(off, off + size);
    if (tag === 77) { // TABLE
      cur = { level, rows: rec.readUInt16LE(6), cols: rec.readUInt16LE(8), cells: [] }; tables.push(cur); cell = null;
    } else if (tag === 72 && cur && level >= cur.level) { // LIST_HEADER
      const col = rec.readUInt16LE(8), row = rec.readUInt16LE(10), cs = rec.readUInt16LE(12), rs = rec.readUInt16LE(14);
      cell = { col, row, cs, rs, text: [] }; cur.cells.push(cell);
    } else if (tag === 67 && cell) {
      let s = "";
      for (let i = 0; i + 1 < rec.length; i += 2) {
        const ch = rec.readUInt16LE(i);
        if (ch === 13 || ch === 10) s += "\n"; else if (ch === 9) s += " "; else if (ch === 24) s += "-"; else if (ch === 30 || ch === 31) s += " ";
        else if (ch < 32) { if (EXT.has(ch)) i += 14; } else s += String.fromCharCode(ch);
      }
      cell.text.push(s.trim());
    }
    off += size;
  }
}
console.error("tables", tables.length, tables.map((t) => `${t.rows}x${t.cols}:${t.cells.length}`).join(" "));
const t = tables.find((t) => t.cells.some((c) => c.text.join("").includes("처분승인기준 내용")));
fs.writeFileSync("b6table.json", JSON.stringify(t, null, 1));
console.error(t ? `별표6 표 ${t.rows}x${t.cols} 셀 ${t.cells.length}` : "못 찾음");
