// Design Ref: §2 — 리포트의 카드 하나. 머리(제목·건수·출처·세부확인), 한 줄 요약 본문으로 이뤄진다.
import type { ReactNode } from "react";
import DetailDialog from "./DetailDialog";
import SourceBadge from "./SourceBadge";
import { EditBody, EditFooter, EditSource, HistoryButton } from "./Edits";
import type { EditableItem, Source } from "@/lib/types";

interface Props {
  title: string;
  /** 머리 옆의 짧은 건수 표시 */
  count?: string;
  source?: Source | null;
  /** 세부확인 창의 내용. 없으면 버튼을 만들지 않는다. */
  detail?: ReactNode;
  /** 과거이력 창의 내용. 없으면 버튼을 만들지 않는다. */
  history?: ReactNode;
  /** 과거이력 창 머리에 붙일 출처(예: 가상 이력이면 "가상") */
  historySource?: Source | null;
  /** 과거이력 건수. 주어지면 카드 아래에 "과거이력 있음/없음"을 적는다. */
  historyCount?: number;
  /** 수정·추가가 가능한 항목이면 필지 id·항목·수정 전 원래 내용을 준다. 없으면 수정 버튼을 만들지 않는다. */
  edit?: { parcelId: string; item: EditableItem; original: string };
  /** 수정·추가 줄의 왼쪽에 붙일 버튼(예: 점유자별 리포트) */
  footerLeft?: ReactNode;
  /** 카드 바깥 상자에 더할 클래스(예: 두 줄에 걸치기) */
  className?: string;
  children: ReactNode;
}

export default function ReportCard({ title, count, source = null, detail, history, historySource = null, historyCount, edit, footerLeft, className = "", children }: Props) {
  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
        <h2 className="min-w-0 truncate text-base font-semibold text-zinc-900">
          {title}
          {count && <span className="ml-1.5 font-normal text-zinc-500">{count}</span>}
          {edit ? <EditSource parcelId={edit.parcelId} item={edit.item} fallback={source} /> : <SourceBadge source={source} />}
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          {history &&
            (edit && historyCount !== undefined ? (
              <HistoryButton parcelId={edit.parcelId} item={edit.item} title={title} baseCount={historyCount} source={historySource}>
                {history}
              </HistoryButton>
            ) : (
              <DetailDialog
                title={title}
                label="과거이력"
                source={historySource}
                buttonLabel={historyCount === undefined ? undefined : historyCount > 0 ? `과거이력 ${historyCount}건` : "과거이력 없음"}
                tone={historyCount === undefined ? "normal" : historyCount > 0 ? "has" : "none"}
              >
                {history}
              </DetailDialog>
            ))}
          {detail && (
            <DetailDialog title={title} source={source}>
              {detail}
            </DetailDialog>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden px-4 py-3 text-base leading-7 text-zinc-800">
        {edit ? (
          <EditBody parcelId={edit.parcelId} item={edit.item}>
            {children}
          </EditBody>
        ) : (
          children
        )}
      </div>
      {edit && <EditFooter parcelId={edit.parcelId} item={edit.item} title={title} original={edit.original} left={footerLeft} />}
    </section>
  );
}

/** 줄 목록(한 줄 요약) */
export function Lines({ lines, oneLine = false }: { lines: string[]; oneLine?: boolean }) {
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((l, i) => (
        <li key={i} className={l === "해당 없음" ? "text-zinc-500" : oneLine ? "truncate" : "line-clamp-3 break-words"} title={oneLine ? l : undefined}>
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
