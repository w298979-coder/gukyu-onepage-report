// Design Ref: §2 — 필지별 한 페이지 리포트. 큰 화면(1920×1080)에서는 페이지 스크롤 없이 한 장에 모든 칸이 보인다.
// Plan: 작업 6. 현재 기준 항목 전체를 한 줄 요약으로 보여주고, 카드마다 세부확인 창을 둔다.
import ReportCard, { DetailLines, Lines } from "./ReportCard";
import { ManagementCard, ReviewProvider, VerdictCard } from "./Review";
import { EditHistory } from "./Edits";
import SourceBadge from "./SourceBadge";
import { buildReport, type BasicRow } from "@/lib/report";
import { ARTICLES, RESTRICTIONS } from "@/lib/law";
import { restrictionViews, selectRestrictions } from "@/lib/review-core";
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
  const restrictions = restrictionViews(selectRestrictions(parcel, RESTRICTIONS), ARTICLES);
  return (
    <ReviewProvider parcelId={parcel.id}>
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2" aria-label={`${v.title} 종합현황`}>
      <ReportCard title="기본 정보" detail={<DetailLines lines={v.basicDetail} />}>
        <Rows rows={v.basic} />
      </ReportCard>

      <ReportCard title="점유자 현황" count={v.occupants.count} source={v.occupants.source} detail={<DetailLines lines={v.occupants.detail} />} history={<><DetailLines lines={v.occupants.history} /><EditHistory parcelId={parcel.id} item="점유자" /></>} historyCount={v.occupants.historyCount} edit={{ parcelId: parcel.id, item: "점유자" }}>
        <Lines lines={v.occupants.summary} />
      </ReportCard>

      <ReportCard title="대부계약 현황" count={v.leases.count} source={v.leases.source} detail={<DetailLines lines={v.leases.detail} />} history={<><DetailLines lines={v.leases.history} /><EditHistory parcelId={parcel.id} item="대부계약" /></>} historyCount={v.leases.historyCount} edit={{ parcelId: parcel.id, item: "대부계약" }}>
        <Lines lines={v.leases.summary} />
      </ReportCard>

      <VerdictCard />

      <ReportCard title="변상금 부과 현황" count={v.penalties.count} source={v.penalties.source} detail={<DetailLines lines={v.penalties.detail} />} history={<><DetailLines lines={v.penalties.history} /><EditHistory parcelId={parcel.id} item="변상금" /></>} historyCount={v.penalties.historyCount} edit={{ parcelId: parcel.id, item: "변상금" }}>
        <Lines lines={v.penalties.summary} />
      </ReportCard>

      <ReportCard title="민원 처리 현황" count={v.complaints.count} source={v.complaints.source} detail={<DetailLines lines={v.complaints.detail} />} history={<><DetailLines lines={v.complaints.history} /><EditHistory parcelId={parcel.id} item="민원" /></>} historyCount={v.complaints.historyCount} edit={{ parcelId: parcel.id, item: "민원" }}>
        <Lines lines={v.complaints.summary} />
      </ReportCard>

      <ReportCard title="기타 관리사항" detail={<DetailLines lines={v.etc.detail} />} history={<><DetailLines lines={v.etc.history} /><EditHistory parcelId={parcel.id} item="기타관리사항" /></>} historyCount={v.etc.historyCount} edit={{ parcelId: parcel.id, item: "기타관리사항" }}>
        <Rows rows={v.etc.rows} />
      </ReportCard>

      <ManagementCard restrictions={restrictions} />
    </div>
    </ReviewProvider>
  );
}
