// Design Ref: §3.1 — 브이월드(항공영상)에서 필지마다 현재 지도를 한 장씩 저장하고, 연속지적도에서 필지 경계를 받아 둔다.
// 결과: public/images/aerial/<PNU>.jpg (지도 캡처), data/aerial.json (중심 좌표, 확대 단계, 크기, 필지 경계).
// 키는 .env 의 VWORLD_KEY 를 이 스크립트에서만 읽고 출력·파일에 남기지 않는다.
// 실행: node --env-file=.env scripts/fetch-aerial.mjs
import fs from "node:fs";

const KEY = process.env.VWORLD_KEY;
if (!KEY) {
  console.error("VWORLD_KEY가 없습니다. .env에 VWORLD_KEY=값 을 넣고 다시 실행하세요.");
  process.exit(1);
}
const DOMAIN = "localhost";
const SIZE = [480, 320];
const mask = (t) => String(t).split(KEY).join("***");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const json = async (url) => {
  const r = await fetch(url);
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`JSON 아님(${r.status}): ${mask(t).slice(0, 100)}`);
  }
};

/** 웹 메르카토르 화면 좌표(픽셀) */
const px = (lon, lat, z) => {
  const W = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * W, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W];
};

const parcels = JSON.parse(fs.readFileSync("data/parcels.json", "utf8")).parcels;
fs.mkdirSync("public/images/aerial", { recursive: true });
const out = {};
for (const p of parcels) {
  try {
    const g = await json(`https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326&type=parcel&format=json&address=${encodeURIComponent(p.지번)}&key=${KEY}`);
    if (g.response?.status !== "OK") throw new Error("좌표 못 찾음");
    const pnu = g.response.refined?.structure?.level4LC ?? p.id;
    const d = await json(`https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LP_PA_CBND_BUBUN&key=${KEY}&format=json&geometry=true&attrFilter=pnu:=:${pnu}&domain=${DOMAIN}`);
    const geom = d.response?.result?.featureCollection?.features?.[0]?.geometry;
    const ring = geom?.type === "MultiPolygon" ? geom.coordinates[0][0] : geom?.type === "Polygon" ? geom.coordinates[0] : null;
    let cx = Number(g.response.result.point.x);
    let cy = Number(g.response.result.point.y);
    if (ring) {
      const xs = ring.map((c) => c[0]);
      const ys = ring.map((c) => c[1]);
      cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    }
    // 필지가 그림의 60% 안에 들어오는 가장 큰 확대 단계(16~19)
    let zoom = 18; // 브이월드 영상 지도는 18단계까지
    if (ring) {
      for (; zoom > 16; zoom--) {
        const pts = ring.map((c) => px(c[0], c[1], zoom));
        const w = Math.max(...pts.map((q) => q[0])) - Math.min(...pts.map((q) => q[0]));
        const h = Math.max(...pts.map((q) => q[1])) - Math.min(...pts.map((q) => q[1]));
        if (w <= SIZE[0] * 0.6 && h <= SIZE[1] * 0.6) break;
      }
    } else zoom = 18;
    const img = await fetch(
      `https://api.vworld.kr/req/image?service=image&request=getmap&key=${KEY}&format=jpeg&basemap=PHOTO&center=${cx},${cy}&crs=epsg:4326&zoom=${zoom}&size=${SIZE.join(",")}&domain=${DOMAIN}`,
    );
    if (!img.headers.get("content-type")?.startsWith("image")) throw new Error("이미지 아님: " + mask(await img.text()).slice(0, 80));
    fs.writeFileSync(`public/images/aerial/${p.id}.jpg`, Buffer.from(await img.arrayBuffer()));
    out[p.id] = { center: [Number(cx.toFixed(7)), Number(cy.toFixed(7))], zoom, size: SIZE, polygon: ring ? ring.map((c) => [Number(c[0].toFixed(7)), Number(c[1].toFixed(7))]) : null };
    console.log("저장:", p.지번, `zoom ${zoom}`, ring ? `경계 ${ring.length}점` : "경계 없음");
  } catch (e) {
    console.log("실패:", p.지번, mask(e.message));
  }
  await sleep(200);
}
fs.writeFileSync("data/aerial.json", JSON.stringify({ _설명: "브이월드 항공영상(PHOTO) 캡처의 중심·확대 단계·크기와 연속지적도 필지 경계(경위도)", _조회일: new Date().toISOString().slice(0, 10), parcels: out }, null, 1) + "\n");
console.log(`완료: ${Object.keys(out).length}/${parcels.length}건`);
