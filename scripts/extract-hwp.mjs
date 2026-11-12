// HWP(5.x) 본문 텍스트 추출기(읽기 전용). 사용: node scripts/extract-hwp.mjs <hwp 파일> <출력 txt>
// 필요한 도구: cfb. 프로젝트에는 설치하지 않았으므로, 별도 폴더에 `npm i cfb` 한 뒤 이 파일을 그 폴더로 복사해 실행한다.
import fs from "node:fs";
import zlib from "node:zlib";
import CFB from "cfb";

const [src, dst] = process.argv.slice(2);
const buf = fs.readFileSync(src);
const cfb = CFB.read(buf, { type: "buffer" });

const header = CFB.find(cfb, "FileHeader");
const flags = header.content.readUInt32LE(36);
const compressed = (flags & 1) !== 0;
const encrypted = (flags & 2) !== 0;
const distribution = (flags & 4) !== 0;
console.error(`버전 ${header.content[35]}.${header.content[34]}.${header.content[33]}.${header.content[32]} 압축=${compressed} 암호=${encrypted} 배포용=${distribution}`);
if (encrypted) throw new Error("암호화된 문서");

const sections = cfb.FullPaths.filter((p) => /BodyText\/Section\d+$/.test(p)).sort((a, b) => Number(a.match(/\d+$/)) - Number(b.match(/\d+$/)));
console.error("섹션", sections.length);

const EXT = new Set([1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
let out = [];
for (const p of sections) {
  let data = CFB.find(cfb, p).content;
  data = Buffer.from(data);
  if (compressed) data = zlib.inflateRawSync(data);
  let off = 0;
  while (off + 4 <= data.length) {
    const h = data.readUInt32LE(off);
    off += 4;
    const tag = h & 0x3ff;
    let size = (h >>> 20) & 0xfff;
    if (size === 0xfff) {
      size = data.readUInt32LE(off);
      off += 4;
    }
    if (tag === 67) {
      // PARA_TEXT
      const rec = data.subarray(off, off + size);
      let s = "";
      for (let i = 0; i + 1 < rec.length; i += 2) {
        const ch = rec.readUInt16LE(i);
        if (ch === 13) s += "\n";
        else if (ch === 9) s += "\t";
        else if (ch === 10) s += "\n";
        else if (ch === 24) s += "-";
        else if (ch === 30 || ch === 31) s += " ";
        else if (ch < 32) {
          if (EXT.has(ch)) i += 14; // 확장 제어 문자는 16바이트를 차지
        } else s += String.fromCharCode(ch);
      }
      out.push(s);
    }
    off += size;
  }
}
fs.writeFileSync(dst, out.join("\n"), "utf8");
console.error(`문단 ${out.length}개, ${out.join("\n").length}자 저장`);
