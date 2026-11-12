// Design Ref: §3.1, §4 — 국가법령정보센터(law.go.kr)의 국유재산법·시행령·시행규칙 본문을 조문 단위로 저장한다.
// Plan: 작업 4 (법령·내규 근거 자료 파일 만들기). 법령 본문은 공개 자료이며, 출처와 시행일을 함께 남긴다.
//
// 실행: node scripts/fetch-law.mjs
// 법제처 API(OC 인증값)는 쓰지 않는다. 화면용 본문 주소를 한 번씩만 받아 온다.
import { mkdir, writeFile } from "node:fs/promises";

const LAWS = [
  { file: "act", 문서명: "국유재산법", lsiSeq: "283349", efYd: "20260820" },
  { file: "decree", 문서명: "국유재산법 시행령", lsiSeq: "288713", efYd: "20260820" },
  { file: "rule", 문서명: "국유재산법 시행규칙", lsiSeq: "282621", efYd: "20260102" },
  // 행정규칙(훈령·고시): 본문 주소 형식이 다르다
  { file: "farmland", 문서명: "국유농지 대부기준", admRulSeq: "2100000280384", efYd: "20260701", 종류: "재정경제부훈령 제160호" },
];

const ENTITIES = { "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&nbsp;": " ", "&#39;": "'", "&middot;": "·" };

function toText(html) {
  return html
    .replace(/<\/p>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(lt|gt|amp|quot|nbsp|middot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function sourceUrl(문서명, 조문번호, kind) {
  const name = encodeURIComponent(문서명.replace(/ /g, ""));
  return kind === "행정규칙"
    ? `https://www.law.go.kr/행정규칙/${name}`
    : `https://www.law.go.kr/법령/${name}/${encodeURIComponent(조문번호)}`;
}

function parseArticles(html, 문서명, kind = "법령") {
  const chunks = html.split('<div class="lawcon">').slice(1);
  const seen = new Set();
  const articles = [];
  for (const chunk of chunks) {
    // 법령은 value="27:0:...", 행정규칙은 value="1-0:0::..." 형식이다
    const m = chunk.match(/<input name="joNoList" id="([A-Z]\d+)"[^>]*value="(\d+)[:-](\d+)[:-]/);
    if (!m) continue; // 장·절 제목 등
    const n = Number(m[2]);
    const sub = Number(m[3]);
    const 조문번호 = `제${n}조${sub ? `의${sub}` : ""}`;
    if (seen.has(조문번호)) continue; // 부칙의 같은 번호는 건너뜀(본문이 먼저 나온다)
    seen.add(조문번호);
    // 마지막 조문 뒤에 붙어 오는 부칙 화면 코드(스크립트 조각)는 잘라낸다
    let text = toText(chunk.split(/<!-- 조 표시 영역 -->|<!-- 부칙 영역 -->|<div id="arDivArea"/)[0]);
    // 뒤에 붙어 온 장·절 제목 줄 제거 (예: "제3절 매각")
    text = text
      .split("\n")
      .filter((line) => !/^제\d+(장|절|관)(의\d+)?\s/.test(line.trim()))
      .join("\n")
      .trim();
    const title = text.match(/^제\d+조(?:의\d+)?\(([^)]+)\)/)?.[1] ?? null;
    articles.push({
      id: `${문서명}-${조문번호}`,
      문서명,
      조문번호,
      제목: title,
      내용: text,
      출처주소: sourceUrl(문서명, 조문번호, kind),
    });
  }
  return articles;
}

await mkdir("data/law", { recursive: true });
for (const law of LAWS) {
  const kind = law.admRulSeq ? "행정규칙" : "법령";
  const url = law.admRulSeq
    ? `https://www.law.go.kr/LSW/admRulInfoR.do?admRulSeq=${law.admRulSeq}`
    : `https://www.law.go.kr/LSW//lsInfoR.do?lsiSeq=${law.lsiSeq}&efYd=${law.efYd}&efYn=Y` +
      `&chrClsCd=010202&nwJoYnInfo=Y&ancYnChk=0&netPrivateYn=N`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.law.go.kr/" } });
  if (!res.ok) throw new Error(`${law.문서명}: 응답 오류 ${res.status}`);
  const html = await res.text();
  const articles = parseArticles(html, law.문서명, kind);
  if (articles.length < (kind === "행정규칙" ? 3 : 10)) throw new Error(`${law.문서명}: 조문을 ${articles.length}개만 읽음. 페이지 형식이 바뀌었는지 확인하세요.`);
  const out = {
    문서명: law.문서명,
    시행일: `${law.efYd.slice(0, 4)}-${law.efYd.slice(4, 6)}-${law.efYd.slice(6, 8)}`,
    출처: law.종류 ? `국가법령정보센터(law.go.kr) 행정규칙, ${law.종류}` : "국가법령정보센터(law.go.kr)",
    조회일: "2026-11-12",
    조문수: articles.length,
    articles,
  };
  await writeFile(`data/law/${law.file}.json`, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`${law.문서명}: 조문 ${articles.length}개 저장 (data/law/${law.file}.json)`);
}
