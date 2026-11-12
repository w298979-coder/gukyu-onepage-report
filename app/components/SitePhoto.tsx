// Design Ref: §2 — 현황사진(가상). 국유재산포털(정보조회)에는 사진 자료가 없어서, 필지의 지목·실제지목(현황)·상태·면적에 맞춰
// 코드가 그리는 예시 그림(SVG)을 보여 준다. 실제 현장 사진이 아니다.
import type { Parcel } from "@/lib/types";

type Scene = "house" | "building" | "field" | "forest" | "road" | "channel" | "grave" | "park" | "vacant";

/** 문자열에서 같은 값이 나오는 난수(필지 id가 같으면 그림도 같다) */
function rng(seedText: string) {
  let a = 0;
  for (const c of seedText) a = (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sceneOf(p: Parcel): Scene {
  const real = p.실제지목.value ?? "";
  const jimok = p.지목.value ?? "";
  const t = `${real} ${jimok}`;
  if (/도로|철도|주차/.test(t)) return "road";
  if (/구거|하천|제방|유지|수도/.test(t)) return "channel";
  if (/묘지/.test(t)) return "grave";
  if (/임야|산림|^임$/.test(t) || jimok === "임") return "forest";
  if (/전|답|과수|목장|농/.test(real) || ["전", "답", "과", "목"].includes(jimok)) return "field";
  if (/공원|학교|체육|광장|운동/.test(t)) return "park";
  if (/공장|창고|상업|업무|주유|판매|영업|숙박/.test(real) || /공|창|장/.test(jimok)) return "building";
  if (/단독|다가구|주택|주거|주상|연립|아파트|다세대/.test(real) || jimok === "대") return "house";
  return "vacant";
}

const W = 480;
const H = 320;

export default function SitePhoto({ parcel, className }: { parcel: Parcel; className?: string }) {
  const r = rng(parcel.id);
  const scene = sceneOf(parcel);
  const horizon = 120 + Math.floor(r() * 20);
  const status = parcel.상태;
  const items: React.ReactNode[] = [];
  let k = 0;
  const key = () => k++;
  const rect = (x: number, y: number, w: number, h: number, fill: string, extra?: object) => <rect key={key()} x={x} y={y} width={w} height={h} fill={fill} {...extra} />;
  const jitter = (n: number) => (r() - 0.5) * n;

  // 하늘·먼 산
  const hill = `M0 ${horizon} Q ${120 + jitter(60)} ${horizon - 40 - r() * 20} 240 ${horizon - 10} T ${W} ${horizon - 20} L ${W} ${horizon} Z`;
  // 땅 색
  const ground: Record<Scene, string> = { house: "#9aa58a", building: "#a7a79a", field: "#b59b5f", forest: "#6f8f5a", road: "#8a8d90", channel: "#8fa07a", grave: "#8fae73", park: "#7fb069", vacant: "#a8a06f" };
  const trees = (n: number, y0: number, y1: number) => {
    for (let i = 0; i < n; i++) {
      const x = 20 + r() * (W - 40);
      const y = y0 + r() * (y1 - y0);
      const s = 0.7 + (y - y0) / (y1 - y0 + 1);
      items.push(
        <g key={key()}>
          {rect(x - 2 * s, y, 4 * s, 18 * s, "#5b4331")}
          <circle cx={x} cy={y - 4 * s} r={14 * s} fill="#3f7a3a" />
          <circle cx={x - 7 * s} cy={y + 2 * s} r={9 * s} fill="#4a8a42" />
        </g>,
      );
    }
  };

  switch (scene) {
    case "house": {
      // 담장과 단독주택
      items.push(rect(0, horizon + 30, W, H - horizon - 30, "#8e9a7e"));
      const hx = 120 + r() * 120;
      const hw = 150 + r() * 40;
      items.push(rect(hx, horizon - 5, hw, 80, "#e6dcc8"));
      items.push(<polygon key={key()} points={`${hx - 12},${horizon - 5} ${hx + hw / 2},${horizon - 55} ${hx + hw + 12},${horizon - 5}`} fill={r() < 0.5 ? "#b5523b" : "#4f6f8a"} />);
      items.push(rect(hx + 20, horizon + 25, 26, 50, "#6b4a32"));
      items.push(rect(hx + hw - 70, horizon + 20, 40, 30, "#a9d0e6"));
      items.push(rect(hx + 60, horizon + 20, 36, 28, "#a9d0e6"));
      items.push(rect(0, horizon + 70, W, 10, "#c8c2b2")); // 담장
      for (let x = 0; x < W; x += 24) items.push(rect(x, horizon + 62, 5, 22, "#b3ad9c"));
      trees(3, horizon + 20, horizon + 60);
      break;
    }
    case "building": {
      items.push(rect(0, horizon + 40, W, H - horizon - 40, "#8d8d86"));
      const bx = 100 + r() * 100;
      items.push(rect(bx, horizon - 40, 220, 110, "#cfd3d6"));
      items.push(rect(bx, horizon - 46, 220, 8, "#8a949c"));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) items.push(rect(bx + 20 + i * 50, horizon - 25 + j * 40, 30, 24, "#8fb3c9"));
      items.push(rect(bx + 90, horizon + 40, 40, 30, "#59626a"));
      break;
    }
    case "field": {
      items.push(rect(0, horizon, W, H - horizon, "#b8a05f"));
      const rows = 9;
      for (let i = 0; i < rows; i++) {
        const y = horizon + 20 + i * ((H - horizon - 20) / rows);
        items.push(<path key={key()} d={`M0 ${y} L ${W} ${y - 6}`} stroke={i % 2 ? "#6c8f3a" : "#7da043"} strokeWidth={5 + i} fill="none" opacity="0.9" />);
      }
      trees(2, horizon + 5, horizon + 25);
      break;
    }
    case "forest": {
      items.push(rect(0, horizon - 10, W, H - horizon + 10, "#66834f"));
      trees(26, horizon, H - 40);
      break;
    }
    case "road": {
      items.push(<polygon key={key()} points={`${W * 0.4},${horizon} ${W * 0.6},${horizon} ${W},${H} 0,${H}`} fill="#6e7174" />);
      items.push(<polygon key={key()} points={`${W * 0.49},${horizon} ${W * 0.51},${horizon} ${W * 0.56},${H} ${W * 0.44},${H}`} fill="#e8d24a" opacity="0.8" />);
      items.push(rect(0, horizon, W * 0.4, H - horizon, "#8aa07a"));
      items.push(rect(W * 0.6, horizon, W * 0.4, H - horizon, "#8aa07a"));
      trees(4, horizon + 5, horizon + 40);
      break;
    }
    case "channel": {
      items.push(<polygon key={key()} points={`0,${horizon + 40} ${W},${horizon + 25} ${W},${H - 40} 0,${H - 20}`} fill="#7ea3b8" />);
      items.push(<path key={key()} d={`M0 ${horizon + 40} L ${W} ${horizon + 25}`} stroke="#6b6e62" strokeWidth="10" />);
      items.push(<path key={key()} d={`M0 ${H - 20} L ${W} ${H - 40}`} stroke="#6b6e62" strokeWidth="12" />);
      for (let i = 0; i < 12; i++) items.push(rect(i * 42 + 6, horizon + 22 - i * 1.1, 3, 14, "#7d8a5c"));
      break;
    }
    case "grave": {
      items.push(rect(0, horizon, W, H - horizon, "#86a96a"));
      for (let i = 0; i < 3; i++) {
        const x = 110 + i * 120 + jitter(30);
        const y = horizon + 70 + jitter(20);
        items.push(<ellipse key={key()} cx={x} cy={y} rx={50} ry={22} fill="#6f9a55" />);
        items.push(rect(x - 6, y - 38, 12, 24, "#bdb8aa"));
      }
      trees(4, horizon, horizon + 40);
      break;
    }
    case "park": {
      items.push(rect(0, horizon, W, H - horizon, "#7fb069"));
      items.push(<path key={key()} d={`M${W * 0.2} ${H} Q ${W * 0.45} ${horizon + 60} ${W * 0.8} ${horizon + 20}`} stroke="#d9cfa8" strokeWidth="26" fill="none" />);
      trees(7, horizon, H - 60);
      items.push(rect(W * 0.7, horizon + 60, 40, 6, "#8a5a3a"));
      break;
    }
    default: {
      items.push(rect(0, horizon, W, H - horizon, "#a8a06f"));
      for (let i = 0; i < 40; i++) items.push(rect(r() * W, horizon + 10 + r() * (H - horizon - 10), 3, 8 + r() * 10, "#6f8f3a", { opacity: 0.7 }));
      for (let i = 0; i < 10; i++) items.push(<ellipse key={key()} cx={r() * W} cy={horizon + 20 + r() * (H - horizon - 30)} rx={14 + r() * 10} ry={5} fill="#8c8458" />);
    }
  }

  // 상태에 따른 현황(가상): 무단점유 = 가설 컨테이너·적치물, 대부 = 대부 안내판, 매각제한·검토 = 경계 안내판
  const over: React.ReactNode[] = [];
  if (status === "사용중인재산(무단점유)") {
    over.push(rect(W * 0.62, H - 120, 80, 40, "#7a8c97"));
    over.push(rect(W * 0.62 + 6, H - 112, 22, 16, "#566872"));
    for (let i = 0; i < 4; i++) over.push(rect(W * 0.25 + i * 14, H - 70 - (i % 2) * 8, 18, 12, ["#c2b280", "#8a6d3b", "#a9a9a9", "#6b8e8a"][i]));
  } else if (status.startsWith("사용중인재산(대부")) {
    over.push(rect(W * 0.08, H - 100, 3, 60, "#6b6b6b"));
    over.push(rect(W * 0.08 - 20, H - 118, 52, 26, "#2f6f4e"));
    over.push(<text key={key()} x={W * 0.08 + 6} y={H - 100} fontSize="9" fill="#fff" textAnchor="middle">국유지</text>);
  } else {
    over.push(rect(W * 0.08, H - 90, 3, 50, "#6b6b6b"));
    over.push(rect(W * 0.08 - 18, H - 106, 48, 22, status === "매각제한재산" ? "#a33" : "#4a6fa5"));
    over.push(<text key={key()} x={W * 0.08 + 6} y={H - 91} fontSize="9" fill="#fff" textAnchor="middle">국유재산</text>);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={`현황사진(가상 이미지): ${parcel.지번}, ${parcel.실제지목.value ?? parcel.지목.value ?? "현황 미상"}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sky-${parcel.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fc1e8" />
          <stop offset="1" stopColor="#dcecf7" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#sky-${parcel.id})`} />
      <path d={hill} fill="#8aa68a" opacity="0.7" />
      <rect y={horizon} width={W} height={H - horizon} fill={ground[scene]} />
      {items}
      {over}
      <rect x="0" y={H - 20} width={W} height="20" fill="rgba(0,0,0,0.45)" />
      <text x="8" y={H - 6} fontSize="11" fill="#fff">
        가상 이미지 · {parcel.실제지목.value ?? parcel.지목.value ?? "현황 미상"} · {parcel.지번.split(" ").slice(-2).join(" ")}
      </text>
    </svg>
  );
}
