// Design Ref: §4 — 관계법령(용도지역·지구·구역을 정한 법령)의 조문을 국가법령정보센터 Open API(법제처)로 받아 data/law/related/ 에 저장한다.
// 인증값(OC)은 .env 의 LAW_OC 에서만 읽고 출력하지 않는다. 실행: node scripts/fetch-related-law.mjs
import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const OC = env.LAW_OC;
if (!OC) {
  console.error(".env 에 LAW_OC 가 없습니다.");
  process.exit(1);
}

export const LAWS = [
  "국토의 계획 및 이용에 관한 법률",
  "국토의 계획 및 이용에 관한 법률 시행령",
  "도시 및 주거환경정비법",
  "개발제한구역의 지정 및 관리에 관한 특별조치법",
  "수도법",
  "철도안전법",
  "철도의 건설 및 철도시설 유지관리에 관한 법률",
  "교육환경 보호에 관한 법률",
  "문화유산의 보존 및 활용에 관한 법률",
  "경관법",
  "가축분뇨의 관리 및 이용에 관한 법률",
  "대기환경보전법",
  "물환경보전법",
  "도시공원 및 녹지 등에 관한 법률",
  "도로법",
  "학교시설사업 촉진법",
];

const text = (x) => (x === undefined || x === null ? "" : Array.isArray(x) ? x.map(text).join("\n") : typeof x === "string" ? x : "");
/** 조문 한 개(조문내용 + 항·호·목)를 글 하나로 합친다 */
function flatten(a) {
  const out = [a.조문내용 ?? ""];
  for (const h of [].concat(a.항 ?? [])) {
    if (typeof h === "string") continue;
    out.push(text(h.항내용));
    for (const ho of [].concat(h.호 ?? [])) {
      out.push(text(ho.호내용));
      for (const mok of [].concat(ho.목 ?? [])) out.push(text(mok.목내용));
    }
  }
  return out.map((s) => s.trim()).filter(Boolean).join("\n");
}

// 파일 이름은 영문으로 둔다(한글 파일 이름을 가져오면 Next.js 개발 서버(Turbopack)가 오류로 멈춘다).
const SLUG = {
  "가축분뇨의 관리 및 이용에 관한 법률": "livestock",
  "개발제한구역의 지정 및 관리에 관한 특별조치법": "greenbelt",
  "경관법": "landscape",
  "교육환경 보호에 관한 법률": "edu-env",
  "국토의 계획 및 이용에 관한 법률 시행령": "planning-decree",
  "국토의 계획 및 이용에 관한 법률": "planning",
  "대기환경보전법": "air",
  "도로법": "road",
  "도시 및 주거환경정비법": "redevelopment",
  "도시공원 및 녹지 등에 관한 법률": "park",
  "문화유산의 보존 및 활용에 관한 법률": "heritage",
  "물환경보전법": "water-env",
  "수도법": "waterworks",
  "철도안전법": "rail-safety",
  "철도의 건설 및 철도시설 유지관리에 관한 법률": "rail-build",
  "학교시설사업 촉진법": "school",
};
const today = new Date().toISOString().slice(0, 10);
for (const name of LAWS) {
  const s = await (await fetch(`http://www.law.go.kr/DRF/lawSearch.do?OC=${OC}&target=law&type=JSON&query=${encodeURIComponent(name)}&display=10`)).json();
  const hit = [].concat(s.LawSearch?.law ?? []).find((l) => l.법령명한글 === name);
  if (!hit) {
    console.log("못 찾음:", name);
    continue;
  }
  const d = await (await fetch(`http://www.law.go.kr/DRF/lawService.do?OC=${OC}&target=law&MST=${hit.법령일련번호}&type=JSON`)).json();
  const units = [].concat(d.법령?.조문?.조문단위 ?? []).filter((a) => a.조문여부 !== "전문");
  const articles = units.map((a) => {
    const no = `제${a.조문번호}조${a.조문가지번호 ? "의" + a.조문가지번호 : ""}`;
    return {
      id: `${name}-${no}`,
      문서명: name,
      조문번호: no,
      제목: a.조문제목 ?? null,
      내용: flatten(a),
      출처주소: `https://www.law.go.kr/법령/${encodeURIComponent(name)}/${encodeURIComponent(no)}`,
    };
  });
  const file = `data/law/related/${SLUG[name]}.json`;
  fs.writeFileSync(file, JSON.stringify({ 문서명: name, 시행일: hit.시행일자, 출처: "국가법령정보센터 Open API(법제처)", 조회일: today, 조문수: articles.length, articles }, null, 1) + "\n");
  console.log(name, articles.length, "조문, 시행", hit.시행일자);
}
