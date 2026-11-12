// Design Ref: §2 — 점유자별 리포트 본문(큰 성명 + 8칸). /occupant/이름 과 메인 조회(점유자로 조회)가 함께 쓴다.
import OccupantReport from "./OccupantReport";
import PrintButton from "./PrintButton";
import type { OccupantReportView } from "@/lib/occupants";

export default function OccupantView({ report }: { report: OccupantReportView }) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
        <p className="text-5xl font-extrabold tracking-tight text-zinc-900" aria-label={`점유자 성명 ${report.이름}`}>
          {report.이름}
        </p>
        <p className="pb-1 text-sm text-zinc-600">
          점유자 · 점유 필지 {report.rows.length}건 · 현재 기준 <PrintButton />
        </p>
      </div>
      <OccupantReport report={report} />
    </>
  );
}
