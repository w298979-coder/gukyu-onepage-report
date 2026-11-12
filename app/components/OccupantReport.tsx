// Design Ref: §2 — 점유자별 리포트 한 페이지. 점유자 한 명의 점유 필지·대부계약·변상금·민원과 주의사항·관리방안을 8칸으로 모은다.
import Link from "next/link";
import ReportCard, { DetailLines, Lines } from "./ReportCard";
import SourceBadge from "./SourceBadge";
import { fmtArea, fmtDate, fmtWon, NONE } from "@/lib/report";
import { shortLot } from "@/lib/occupant-core";
import type { CitedSentence, OccupantReportView } from "@/lib/occupants";

function Cites({ s }: { s: CitedSentence }) {
  return (
    <span className="ml-1 text-xs text-zinc-500">
      {s.citations.map((c, i) => (
        <span key={c.id}>
          {i > 0 && ", "}
          <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
            {c.label}
          </a>
        </span>
      ))}
    </span>
  );
}

const lotHref = (addr: string) => `/?q=${encodeURIComponent(shortLot(addr))}`;

export default function OccupantReport({ report }: { report: OccupantReportView }) {
  const { rows, totals } = report;
  const leases = rows.flatMap((r) => r.leases.map((l) => ({ lot: r.parcel.지번, l })));
  const pens = rows.flatMap((r) => r.penalties.map((x) => ({ lot: r.parcel.지번, x })));
  const complaints = rows.flatMap((r) => r.parcel.민원.map((c) => ({ lot: r.parcel.지번, c })));

  const parcelTail = rows.map((r) => ` · ${r.parcel.상태} · 점유 ${fmtArea(r.occupant.점유면적)} · ${fmtDate(r.occupant.점유시작일)}부터${r.noValidLease ? " · 유효 대부계약 없음" : ""}`);
  const parcelLines = rows.map((r, i) => `${shortLot(r.parcel.지번)}${parcelTail[i]}`);
  const leaseLines = leases.map(({ lot, l }) => `${shortLot(lot)} · ${l.상태} · ${fmtDate(l.계약시작일)} ~ ${fmtDate(l.계약종료일)} · 연 사용료 ${fmtWon(l.연사용료)}`);
  const penLines = pens.map(({ lot, x }) => `${shortLot(lot)} · ${fmtDate(x.부과일)} 부과 · ${fmtWon(x.금액)} · ${x.납부상태}`);
  const complaintLines = complaints.map(({ lot, c }) => `${shortLot(lot)} · ${fmtDate(c.접수일)} · ${c.처리상태} · ${c.내용}`);
  const lim = (lines: string[], n = 4) => (lines.length === 0 ? [NONE] : lines.length > n ? [...lines.slice(0, n), `외 ${lines.length - n}건 (세부확인)`] : lines);
  const all = (lines: string[]) => (lines.length === 0 ? [NONE] : lines);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2 print:grid-cols-4 print:grid-rows-2" aria-label={`${report.이름} 점유자별 리포트`}>
      <ReportCard title="요약" source="가상">
        <dl className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1.5">
          <dt className="text-zinc-500">점유 필지</dt>
          <dd>
            {totals.parcels}건 · 점유면적 합계 {fmtArea(Math.round(totals.area * 10) / 10)}
          </dd>
          <dt className="text-zinc-500">대부계약</dt>
          <dd>
            유효 {totals.validLeases}건 · 연 사용료 합계 {fmtWon(totals.leaseFee)}
          </dd>
          <dt className="text-zinc-500">변상금</dt>
          <dd>
            {totals.penalties}건 · 부과액 {fmtWon(totals.penaltyAmount)}
            <span className={totals.unpaidCount ? "block font-medium text-red-700" : "block text-zinc-500"}>
              미납·일부납부 {totals.unpaidCount}건{totals.unpaidCount ? ` (${fmtWon(totals.unpaidAmount)})` : ""}
            </span>
          </dd>
          <dt className="text-zinc-500">민원</dt>
          <dd>
            점유 필지 기준 {complaints.length}건 · 미완료 {totals.openComplaints}건
          </dd>
        </dl>
      </ReportCard>

      <ReportCard title="점유 필지" count={`${rows.length}건`} source="가상" detail={<DetailLines lines={all(parcelLines)} />}>
        <ul className="flex flex-col gap-1">
          {rows.slice(0, 4).map((r, i) => (
            <li key={r.occupant.id} className="line-clamp-3 break-words">
              <Link href={lotHref(r.parcel.지번)} className="font-medium text-blue-700 underline">
                {shortLot(r.parcel.지번)}
              </Link>
              {parcelTail[i]}
            </li>
          ))}
          {rows.length > 4 && <li className="text-zinc-500">외 {rows.length - 4}건 (세부확인)</li>}
        </ul>
      </ReportCard>

      <ReportCard title="대부계약" count={leases.length ? `${leases.length}건` : NONE} source={leases.length ? "가상" : null} detail={<DetailLines lines={all(leaseLines)} />}>
        <Lines lines={lim(leaseLines)} />
      </ReportCard>

      <ReportCard
        title="변상금"
        count={pens.length ? `${pens.length}건${totals.unpaidCount ? ` · 미납 ${totals.unpaidCount}` : ""}` : NONE}
        source={pens.length ? "가상" : null}
        detail={<DetailLines lines={all(penLines)} />}
      >
        <Lines lines={lim(penLines)} />
      </ReportCard>

      <ReportCard title="민원 (점유 필지)" count={complaints.length ? `${complaints.length}건` : NONE} source={complaints.length ? "가상" : null} detail={<DetailLines lines={all(complaintLines)} />}>
        <Lines lines={lim(complaintLines)} />
      </ReportCard>

      <ReportCard title="주의사항" count={`${report.cautions.length}건`}>
        <ul className="flex flex-col gap-1.5 text-sm">
          {report.cautions.map((c, i) => (
            <li key={i} className="break-words">
              {c.text}
              <Cites s={c} />
            </li>
          ))}
        </ul>
      </ReportCard>

      <ReportCard title="관리방안">
        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm">
          {report.plan.map((c, i) => (
            <li key={i} className="break-words">
              {c.text}
              <Cites s={c} />
            </li>
          ))}
        </ol>
      </ReportCard>

      <ReportCard title="안내">
        <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-zinc-700">
          <li>
            <SourceBadge source="가상" /> 점유자 이름은 마스킹된 가상 이름이며, <b>같은 이름을 같은 점유자</b>로 묶었습니다. 실제 점유자를 식별하는 자료가 아닙니다.
          </li>
          <li>주의사항·관리방안은 AI가 아니라 코드의 규칙(미납 변상금, 무계약 점유, 만료 임박 계약)으로 만들며 근거 조문을 함께 표시합니다.</li>
          <li>민원은 점유자가 아니라 필지 기준 자료입니다. 담당자의 판단을 돕는 참고용입니다.</li>
        </ul>
      </ReportCard>
    </div>
  );
}
