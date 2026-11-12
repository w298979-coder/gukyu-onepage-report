// Design Ref: §2 — 리포트의 카드 하나. 머리(제목·건수·출처·세부확인), 한 줄 요약 본문으로 이뤄진다.
import type { ReactNode } from "react";
import DetailDialog from "./DetailDialog";
import SourceBadge from "./SourceBadge";
import type { Source } from "@/lib/types";

interface Props {
  title: string;
  /** 머리 옆의 짧은 건수 표시 */
  count?: string;
  source?: Source | null;
  /** 세부확인 창의 내용. 없으면 버튼을 만들지 않는다. */
  detail?: ReactNode;
  /** 과거이력 창의 내용. 없으면 버튼을 만들지 않는다. */
  history?: ReactNode;
  children: ReactNode;
}

export default function ReportCard({ title, count, source = null, detail, history, children }: Props) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
        <h2 className="min-w-0 truncate text-base font-semibold text-zinc-900">
          {title}
          {count && <span className="ml-1.5 font-normal text-zinc-500">{count}</span>}
          <SourceBadge source={source} />
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {history && (
            <DetailDialog title={title} label="과거이력">
              {history}
            </DetailDialog>
          )}
          {detail && <DetailDialog title={title}>{detail}</DetailDialog>}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden px-4 py-3 text-base leading-7 text-zinc-800">{children}</div>
    </section>
  );
}

/** 줄 목록(한 줄 요약) */
export function Lines({ lines }: { lines: string[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((l, i) => (
        <li key={i} className={l === "해당 없음" ? "text-zinc-500" : "line-clamp-3 break-words"}>
          {l}
        </li>
      ))}
    </ul>
  );
}

/** 세부확인 창 안의 줄 목록(줄바꿈 유지) */
export function DetailLines({ lines }: { lines: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((l, i) => (
        <li key={i} className={`whitespace-pre-wrap break-words ${l.startsWith("  ") ? "ml-4 text-zinc-700" : ""}`}>
          {l.trimStart()}
        </li>
      ))}
    </ul>
  );
}

/** 작업 9에서 채울 칸 */
export function PendingCard({ title, note }: { title: string; note: string }) {
  return (
    <ReportCard title={title}>
      <p className="text-zinc-500">{note}</p>
    </ReportCard>
  );
}
