// Design Ref: §2 — 필지별 한 페이지 리포트. 큰 화면(1920×1080)에서는 페이지 스크롤 없이 한 장에 모든 칸이 보인다.
// Plan: 작업 6. 현재 기준 항목 전체를 한 줄 요약으로 보여주고, 카드마다 세부확인 창을 둔다.
import ReportCard, { DetailLines, Lines, PendingCard } from "./ReportCard";
import SourceBadge from "./SourceBadge";
import { buildReport, type BasicRow } from "@/lib/report";
import type { Parcel } from "@/lib/types";

function Rows({ rows }: { rows: BasicRow[] }) {
  return (
    <dl className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-zinc-500">{r.label}</dt>
          <dd className="min-w-0 break-words">
            <span className={r.value === "해당 없음" ? "text-zinc-500" : ""}>{r.value}</span>
            <SourceBadge source={r.source} />
            {r.note && <span className="mt-0.5 block text-xs text-zinc-500">{r.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function Report({ parcel }: { parcel: Parcel }) {
  const v = buildReport(parcel);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2" aria-label={`${v.title} 종합현황`}>
      <ReportCard title="기본 정보" detail={<DetailLines lines={v.basicDetail} />}>
        <Rows rows={v.basic} />
      </ReportCard>

      <ReportCard title="점유자 현황" count={v.occupants.count} source={v.occupants.source} detail={<DetailLines lines={v.occupants.detail} />}>
        <Lines lines={v.occupants.summary} />
      </ReportCard>

      <ReportCard title="대부계약 현황" count={v.leases.count} source={v.leases.source} detail={<DetailLines lines={v.leases.detail} />}>
        <Lines lines={v.leases.summary} />
      </ReportCard>

      <PendingCard title="매각가능여부 검토" note="저장된 법령·내규를 근거로 판정을 만드는 기능은 작업 9에서 이 칸에 추가합니다." />

      <ReportCard title="변상금 부과 현황" count={v.penalties.count} source={v.penalties.source} detail={<DetailLines lines={v.penalties.detail} />}>
        <Lines lines={v.penalties.summary} />
      </ReportCard>

      <ReportCard title="민원 처리 현황" count={v.complaints.count} source={v.complaints.source} detail={<DetailLines lines={v.complaints.detail} />}>
        <Lines lines={v.complaints.summary} />
      </ReportCard>

      <ReportCard title="기타 관리사항" detail={<DetailLines lines={v.etc.detail} />}>
        <Rows rows={v.etc.rows} />
      </ReportCard>

      <PendingCard title="대부·처분 제한사항 / 관리방안" note="제한 조항과 주의사항은 작업 9에서 이 칸에 추가합니다." />
    </div>
  );
}
