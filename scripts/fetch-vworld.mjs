// Design Ref: §3.1 — 포털 30건의 토지 정보를 브이월드에서 조회해 data/vworld-parcels.json 으로 저장한다.
// Plan: 작업 2. 키는 서버 쪽(이 스크립트)에서만 읽고, 출력과 파일에는 남기지 않는다.
//
// 실행: node --env-file=.env scripts/fetch-vworld.mjs
import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.VWORLD_KEY;
if (!KEY) {
  console.error("VWORLD_KEY가 없습니다. .env에 VWORLD_KEY=값 을 넣고 다시 실행하세요.");
  process.exit(1);
}

const DOMAIN = "localhost"; // 브이월드 호출 때 붙이는 도메인 값
const PAUSE_MS = 150; // 서버에 부담을 주지 않도록 호출 사이에 잠깐 쉰다

/** 오류 문구에 키가 섞여도 출력되지 않게 가린다. */
const mask = (text) => String(text).split(KEY).join("***");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON이 아닌 응답(상태 ${res.status}): ${mask(text).slice(0, 120)}`);
  }
}

/** 소재지 문자열 → 브이월드 고유번호(PNU). 못 찾으면 null. */
async function findPnu(address) {
  const url =
    `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0` +
    `&crs=epsg:4326&type=parcel&format=json&address=${encodeURIComponent(address)}&key=${KEY}`;
  const j = await getJson(url);
  if (j?.response?.status !== "OK") return null;
  return j.response.refined?.structure?.level4LC ?? null;
}

/** NED(토지 정보) API 호출. 응답 안의 목록(field)을 꺼내 준다. */
async function ned(endpoint, pnu) {
  const url =
    `https://api.vworld.kr/ned/data/${endpoint}?key=${KEY}&pnu=${pnu}&format=json` +
    `&numOfRows=100&pageNo=1&domain=${DOMAIN}`;
  const j = await getJson(url);
  const root = Object.values(j)[0];
  return Array.isArray(root?.field) ? root.field : [];
}

const num = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};

/** 토지특성 → 가장 최근 기준의 면적·지목·이용상황 */
function pickCharacteristics(rows) {
  if (rows.length === 0) return null;
  const latest = [...rows].sort((a, b) =>
    `${b.stdrYear}${b.stdrMt}`.localeCompare(`${a.stdrYear}${a.stdrMt}`),
  )[0];
  return {
    면적: num(latest.lndpclAr),
    지목: latest.lndcgrCodeNm || null,
    이용상황: latest.ladUseSittnNm || null,
    기준연도: num(latest.stdrYear),
  };
}

/** 토지이용계획 → 용도지역·지구 이름 목록 (포함·저촉만, 중복 제거) */
function pickLandUse(rows) {
  const names = rows
    .filter((r) => r.cnflcAtNm === "포함" || r.cnflcAtNm === "저촉")
    .map((r) => r.prposAreaDstrcCodeNm)
    .filter(Boolean);
  return [...new Set(names)];
}

/** 개별공시지가 → 연도별 단가(연도마다 가장 늦은 공시일 하나), 오름차순 */
function pickPrices(rows) {
  const byYear = new Map();
  for (const r of rows) {
    const year = num(r.stdrYear);
    const price = num(r.pblntfPclnd);
    if (year === null || price === null) continue;
    const prev = byYear.get(year);
    if (!prev || String(r.pblntfDe) > String(prev.date)) byYear.set(year, { date: r.pblntfDe, price });
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([연도, v]) => ({ 연도, 단가: v.price }));
}

const portal = JSON.parse(await readFile("data/portal-parcels.json", "utf8")).parcels;
const results = [];
const problems = [];

for (const [i, p] of portal.entries()) {
  const label = `${i + 1}/${portal.length} ${p.지번}`;
  const entry = { 지번: p.지번, pnu: null, 특성: null, 용도지역: [], 공시지가: [], 메모: [] };
  try {
    entry.pnu = await findPnu(p.지번);
    if (!entry.pnu) {
      entry.메모.push("브이월드에서 고유번호를 찾지 못함");
    } else {
      await sleep(PAUSE_MS);
      entry.특성 = pickCharacteristics(await ned("getLandCharacteristics", entry.pnu));
      if (!entry.특성) entry.메모.push("토지특성정보 없음");
      await sleep(PAUSE_MS);
      entry.용도지역 = pickLandUse(await ned("getLandUseAttr", entry.pnu));
      if (entry.용도지역.length === 0) entry.메모.push("토지이용계획 없음");
      await sleep(PAUSE_MS);
      entry.공시지가 = pickPrices(await ned("getIndvdLandPriceAttr", entry.pnu));
      if (entry.공시지가.length === 0) entry.메모.push("개별공시지가 없음");
    }
  } catch (e) {
    entry.메모.push(`조회 오류: ${mask(e.message)}`);
  }
  if (entry.메모.length > 0) problems.push(`${label} → ${entry.메모.join(", ")}`);
  console.log(`${label} ${entry.pnu ? "OK" : "PNU 없음"}${entry.메모.length ? " (메모 있음)" : ""}`);
  results.push(entry);
  await sleep(PAUSE_MS);
}

const out = {
  _source: "브이월드(vworld.kr) 연속지적도 주소 변환, 토지특성정보, 토지이용계획, 개별공시지가",
  _fetchedAt: new Date().toISOString(),
  parcels: results,
};
await writeFile("data/vworld-parcels.json", JSON.stringify(out, null, 2) + "\n", "utf8");

console.log(`\n저장: data/vworld-parcels.json (${results.length}건)`);
console.log(`문제가 있는 필지 ${problems.length}건`);
for (const line of problems) console.log(" - " + line);
