// Design Ref: §2 — 필지별 한 페이지 리포트. 큰 화면(1920×1080)에서는 페이지 스크롤 없이 한 장에 모든 칸이 보인다.
// Plan: 작업 6. 현재 기준 항목 전체를 한 줄 요약으로 보여주고, 카드마다 세부확인 창을 둔다.
import ReportCard, { DetailLines, Lines } from "./ReportCard";
import { ManagementCard, ReviewProvider, VerdictCard } from "./Review";
import { EditHistory } from "./Edits";
import AerialPhoto, { hasAerial } from "./AerialPhoto";
import OccupantReportButton from "./OccupantReportButton";
import PhotoFrame from "./PhotoFrame";
import SitePhoto from "./SitePhoto";
import SourceBadge from "./SourceBadge";
import { buildReport, type BasicRow } from "@/lib/report";
import { ARTICLES, MISSING_DOCS, RELATED_ARTICLES, RELATED_DEFS, RESTRICTIONS } from "@/lib/law";
import { reviewRelated } from "@/lib/related-core";
import { restrictionViews, selectRestrictions } from "@/lib/review-core";
import type { RelatedResult } from "@/lib/related-core";
import type { Parcel } from "@/lib/types";

const TAG = {
  "제한 있음": { text: "처분제한", cls: "bg-red-100 text-red-800" },
  "조건부 확인 필요": { text: "조건부", cls: "bg-amber-100 text-amber-900" },
} as const;

/** 브이월드 용도지역·지구·구역을 처분(매각)제한이 있는 것 → 조건부 → 그 밖의 순서로 늘어놓는다 */
function orderedZones(zones: string[], related: RelatedResult) {
  const tagOf = new Map<string, keyof typeof TAG>();
  for (const i of related.items) if (i.판정 !== "제한 확인되지 않음") for (const z of i.구역) tagOf.set(z, i.판정);
  const rank = (z: string) => (tagOf.get(z) === "제한 있음" ? 0 : tagOf.get(z) === "조건부 확인 필요" ? 1 : 2);
  return [...zones].sort((a, b) => rank(a) - rank(b)).map((name) => ({ name, tag: tagOf.get(name) ?? null }));
}

/** 용도지역·지구 칸: 처분제한 구역을 앞에 표시하고 나머지는 개수로 줄인다 */
function ZoneValue({ zones, related }: { zones: string[]; related: RelatedResult }) {
  const list = orderedZones(zones, related);
  const flagged = list.filter((z) => z.tag);
  const rest = list.filter((z) => !z.tag);
  const shownRest = flagged.length > 0 ? rest.slice(0, 1) : rest.slice(0, 2);
  const hidden = rest.length - shownRest.length;
  return (
    <span>
      {[...flagged, ...shownRest].map((z, i) => (
        <span key={z.name}>
          {i > 0 && ", "}
          <span className={z.tag ? "font-medium" : ""}>{z.name}</span>
          {z.tag && <span className={`ml-1 rounded px-1 py-0.5 align-middle text-xs font-semibold leading-none ${TAG[z.tag].cls}`}>{TAG[z.tag].text}</span>}
        </span>
      ))}
      {hidden > 0 && <span className="text-zinc-500"> 외 {hidden}</span>}
    </span>
  );
}

function Rows({ rows, zones, related }: { rows: BasicRow[]; zones?: string[]; related?: RelatedResult }) {
  return (
    <dl className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-zinc-500">{r.label}</dt>
          <dd className="min-w-0 break-words">
            {r.label === "용도지역·지구" && zones && zones.length > 0 && related ? (
              <ZoneValue zones={zones} related={related} />
            ) : (
              <span className={r.value === "해당 없음" ? "text-zinc-500" : ""}>{r.value}</span>
            )}
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
  const related = reviewRelated(parcel.용도지역.value, RELATED_DEFS, RELATED_ARTICLES);
  const restrictions = restrictionViews(selectRestrictions(parcel, RESTRICTIONS), ARTICLES);
  const zoneList = parcel.용도지역.value ?? [];
  const detailLines = v.basicDetail.map((l) =>
    l.startsWith("용도지역·지구 전체:")
      ? `용도지역·지구 전체(처분제한 먼저): ${zoneList.length ? orderedZones(zoneList, related).map((z) => (z.tag ? `${z.name}[${TAG[z.tag].text}]` : z.name)).join(", ") : "해당 없음"}`
      : l,
  );
  return (
    <ReviewProvider parcelId={parcel.id}>
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2 print:grid-cols-4 print:grid-rows-2" aria-label={`${v.title} 종합현황`}>
      <ReportCard title="기본 정보" detail={<DetailLines lines={detailLines} />} history={<DetailLines lines={v.basicHistory} />} historySource="브이월드" historyCount={v.basicHistoryCount} className="xl:row-span-2 print:row-span-2">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <PhotoFrame title="현황사진" source="가상 이미지(국유재산포털에 사진 자료 없음)">
            <SitePhoto parcel={parcel} className="block aspect-[3/2] w-full" />
          </PhotoFrame>
          {hasAerial(parcel.id) ? (
            <PhotoFrame title="항공사진" source="브이월드 항공영상 캡처 · 붉은 선은 필지 경계">
              <AerialPhoto parcelId={parcel.id} jibun={parcel.지번} className="w-full" />
            </PhotoFrame>
          ) : (
            <p className="text-sm text-zinc-500">항공사진: 해당 없음</p>
          )}
        </div>
        <Rows rows={v.basic} zones={parcel.용도지역.value ?? []} related={related} />
      </ReportCard>

      <ReportCard title="점유자 현황" count={v.occupants.count} source={v.occupants.source} detail={<DetailLines lines={v.occupants.detail} />} history={<><DetailLines lines={v.occupants.history} /><EditHistory parcelId={parcel.id} item="점유자" /></>} historyCount={v.occupants.historyCount} historySource="가상" footerLeft={<OccupantReportButton names={[...new Set(parcel.점유자.map((o) => o.이름))]} />} edit={{ parcelId: parcel.id, item: "점유자", original: v.occupants.detail.join("\n") }}>
        <Lines lines={v.occupants.summary} />
      </ReportCard>

      <ReportCard title="대부계약 현황" count={v.leases.count} source={v.leases.source} detail={<DetailLines lines={v.leases.detail} />} history={<><DetailLines lines={v.leases.history} /><EditHistory parcelId={parcel.id} item="대부계약" /></>} historyCount={v.leases.historyCount} historySource="가상" edit={{ parcelId: parcel.id, item: "대부계약", original: v.leases.detail.join("\n") }}>
        <Lines lines={v.leases.summary} />
      </ReportCard>

      <VerdictCard related={related} />

      <ReportCard title="변상금 부과 현황" count={v.penalties.count} source={v.penalties.source} detail={<DetailLines lines={v.penalties.detail} />} history={<><DetailLines lines={v.penalties.history} /><EditHistory parcelId={parcel.id} item="변상금" /></>} historyCount={v.penalties.historyCount} historySource="가상" edit={{ parcelId: parcel.id, item: "변상금", original: v.penalties.detail.join("\n") }}>
        <Lines lines={v.penalties.summary} />
      </ReportCard>

      <ReportCard title="민원 처리 현황" count={v.complaints.count} source={v.complaints.source} detail={<DetailLines lines={v.complaints.detail} />} history={<><DetailLines lines={v.complaints.history} /><EditHistory parcelId={parcel.id} item="민원" /></>} historyCount={v.complaints.historyCount} historySource="가상" edit={{ parcelId: parcel.id, item: "민원", original: v.complaints.detail.join("\n") }}>
        <Lines lines={v.complaints.summary} />
      </ReportCard>

      <ManagementCard restrictions={restrictions} missing={MISSING_DOCS} memo={parcel.기타관리사항.value} />
    </div>
    </ReviewProvider>
  );
}
