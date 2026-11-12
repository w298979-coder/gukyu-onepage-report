// Design Ref: §2 — 값 옆에 붙이는 출처 표시. 가상 정보가 실제 사실로 오해되지 않게 눈에 띄는 색을 쓴다.
import type { Source } from "@/lib/types";

const STYLE: Record<Source, string> = {
  브이월드: "bg-sky-100 text-sky-800",
  포털: "bg-emerald-100 text-emerald-800",
  가상: "bg-amber-100 text-amber-900",
  수정: "bg-violet-100 text-violet-800",
};

export default function SourceBadge({ source }: { source: Source | null }) {
  if (!source) return null;
  return (
    <span className={`ml-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-xs font-medium leading-none ${STYLE[source]}`}>
      {source === "가상" ? "가상 데이터" : source}
    </span>
  );
}
