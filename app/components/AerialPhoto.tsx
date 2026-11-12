// Design Ref: §2 — 항공사진: 브이월드(항공영상) 지도에서 필지 위치를 캡처해 저장한 사진(public/images/aerial)과 필지 경계를 겹쳐 보여 준다.
// 캡처와 경계 좌표는 scripts/fetch-aerial.mjs 가 만들며, 화면에는 키가 필요 없다.
import aerial from "@/data/aerial.json";

interface Entry {
  center: [number, number];
  zoom: number;
  size: [number, number];
  polygon: [number, number][] | null;
}
const entries = aerial.parcels as unknown as Record<string, Entry>;

/** 웹 메르카토르 픽셀 좌표 */
const mercator = (lon: number, lat: number, z: number): [number, number] => {
  const W = 256 * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * W, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W];
};

export function hasAerial(parcelId: string): boolean {
  return !!entries[parcelId];
}

export default function AerialPhoto({ parcelId, jibun, className }: { parcelId: string; jibun: string; className?: string }) {
  const e = entries[parcelId];
  if (!e) return null;
  const [w, h] = e.size;
  const [cx, cy] = mercator(e.center[0], e.center[1], e.zoom);
  const path = e.polygon
    ? e.polygon
        .map(([lon, lat], i) => {
          const [x, y] = mercator(lon, lat, e.zoom);
          return `${i === 0 ? "M" : "L"}${(w / 2 + x - cx).toFixed(1)} ${(h / 2 + y - cy).toFixed(1)}`;
        })
        .join(" ") + " Z"
    : null;
  return (
    <div className={`relative ${className ?? ""}`} style={{ aspectRatio: "4 / 3" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/images/aerial/${parcelId}.jpg`} alt={`항공사진(브이월드): ${jibun}`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      {path && (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d={path} fill="rgba(255,60,60,0.18)" stroke="#ff3b30" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
