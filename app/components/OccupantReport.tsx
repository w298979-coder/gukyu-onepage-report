// Design Ref: §2 — 점유자별 리포트 한 페이지. 점유자 한 명의 점유 필지·대부계약·변상금·민원과 주의사항·관리방안을 8칸으로 모은다.
// 각 칸은 상태(무단점유·대부 유효·미납·미완료 등)가 급한 것부터 정렬하고 상태를 색 표시로 붙인다.
import Link from "next/link";
import type { ReactNode } from "react";
import MoreItems from "./MoreItems";
import ReportCard, { DetailLines } from "./ReportCard";
import SourceBadge from "./SourceBadge";
import { fmtArea, fmtDate, fmtWon, NONE, oneLine } from "@/lib/report";
import { shortLot } from "@/lib/occupant-core";
import type { CitedSentence, OccupantReportView } from "@/lib/occupants";

type Tone = "red" | "amber" | "green" | "zinc";
const TONE: Record<Tone, string> = {
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-900",
  green: "bg-emerald-100 text-emerald-800",
  zinc: "bg-zinc-100 text-zinc-600",
};

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`mr-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[13px] font-semibold leading-none ${TONE[tone]}`}>{children}</span>;
}

function Cites({ s }: { s: CitedSentence }) {
  return (
    <span className="ml-1 text-[13px] text-zinc-500">
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
const byDateDesc = (a: string | null, b: string | null) => (b ?? "").localeCompare(a ?? "");

/** 칸 하나의 한 줄 목록: 상태 표시 + 글 */
interface Item {
  key: string;
  tone: Tone;
  chip: string;
  text: string;
  /** 앞에 링크로 만들 글(필지 지번) */
  link?: string;
}
function ItemList({ items, title, detail, max = 4, emptyText = NONE, single = false }: { items: Item[]; title: string; detail: ReactNode; max?: number; emptyText?: string; single?: boolean }) {
  if (items.length === 0) return <p className="text-zinc-500">{emptyText}</p>;
  return (
    <>
    <ul className="flex flex-col gap-1.5">
      {items.slice(0, max).map((it) => (
        <li key={it.key} className={single ? "truncate text-[15px]" : "line-clamp-3 break-words"} title={single ? `${it.link ? shortLot(it.link) : ""}${it.text}` : undefined}>
          <Chip tone={it.tone}>{it.chip}</Chip>
          {it.link ? (
            <>
              <Link href={lotHref(it.link)} className="font-medium text-blue-700 underline">
                {shortLot(it.link)}
              </Link>
              {it.text}
            </>
          ) : (
            it.text
          )}
        </li>
      ))}
    </ul>
    <MoreItems title={title} count={items.length - max}>
      {detail}
    </MoreItems>
    </>
  );
}
const lines = (items: Item[]) => (items.length === 0 ? [NONE] : items.map((it) => `[${it.chip}] ${it.link ? shortLot(it.link) : ""}${it.text}`));

export default function OccupantReport({ report }: { report: OccupantReportView }) {
  const { rows, totals } = report;

  // 점유 필지: 무단점유 → 대부 유효, 그 안에서 사용중 필지 먼저
  const parcels = [...rows]
    .sort((a, b) => Number(!a.noValidLease) - Number(!b.noValidLease) || Number(!a.parcel.상태.startsWith("사용중")) - Number(!b.parcel.상태.startsWith("사용중")))
    .map<Item>((r) => ({
      key: r.occupant.id,
      tone: r.noValidLease ? "red" : "green",
      chip: r.noValidLease ? "무단점유" : "대부 유효",
      link: r.parcel.지번,
      text: ` · ${r.parcel.상태} · 점유 ${fmtArea(r.occupant.점유면적)} · ${fmtDate(r.occupant.점유시작일)}부터`,
    }));

  // 대부계약: 유효(만료가 가까운 순) → 만료 → 해지
  const leaseRank = { 유효: 0, 만료: 1, 해지: 2 } as const;
  const leases = rows
    .flatMap((r) => r.leases.map((l) => ({ lot: r.parcel.지번, l })))
    .sort((a, b) => leaseRank[a.l.상태] - leaseRank[b.l.상태] || (a.l.계약종료일 ?? "").localeCompare(b.l.계약종료일 ?? ""))
    .map<Item>(({ lot, l }, i) => ({
      key: `${l.id}-${i}`,
      tone: l.상태 === "유효" ? "green" : l.상태 === "만료" ? "zinc" : "amber",
      chip: l.상태 === "유효" ? "유효" : l.상태,
      link: lot,
      text: ` · ${fmtDate(l.계약시작일)} ~ ${fmtDate(l.계약종료일)} · 연 ${fmtWon(l.연사용료)}`,
    }));

  // 변상금: 미납 → 일부납부 → 완납, 같은 상태는 최근 부과순
  const penRank = { 미납: 0, 일부납부: 1, 완납: 2 } as const;
  const pens = rows
    .flatMap((r) => r.penalties.map((x) => ({ lot: r.parcel.지번, x })))
    .sort((a, b) => penRank[a.x.납부상태] - penRank[b.x.납부상태] || byDateDesc(a.x.부과일, b.x.부과일))
    .map<Item>(({ lot, x }, i) => ({
      key: `${x.id}-${i}`,
      tone: x.납부상태 === "미납" ? "red" : x.납부상태 === "일부납부" ? "amber" : "green",
      chip: x.납부상태,
      link: lot,
      text: ` · ${fmtDate(x.부과일)} 부과 · ${fmtWon(x.금액)}`,
    }));

  // 민원(점유 필지 기준): 처리 미완료(접수·처리중) → 완료, 같은 상태는 최근 접수순
  const cRank = { 접수: 0, 처리중: 1, 완료: 2 } as const;
  const complaints = rows
    .flatMap((r) => r.parcel.민원.map((c) => ({ lot: r.parcel.지번, c })))
    .sort((a, b) => cRank[a.c.처리상태] - cRank[b.c.처리상태] || byDateDesc(a.c.접수일, b.c.접수일))
    .map<Item>(({ lot, c }, i) => ({
      key: `${c.id}-${i}`,
      tone: c.처리상태 === "접수" ? "red" : c.처리상태 === "처리중" ? "amber" : "green",
      chip: c.처리상태 === "완료" ? "처리완료" : c.처리상태,
      link: lot,
      text: ` · ${oneLine(c.내용, 16)} · ${c.민원인}`,
    }));
  const fullComplaints = (() => {
    const all = rows
      .flatMap((r) => r.parcel.민원.map((c) => ({ lot: r.parcel.지번, c })))
      .sort((a, b) => cRank[a.c.처리상태] - cRank[b.c.처리상태] || byDateDesc(a.c.접수일, b.c.접수일));
    return all.length === 0 ? [NONE] : all.map(({ lot, c }) => `[${c.처리상태 === "완료" ? "처리완료" : c.처리상태}] ${shortLot(lot)} · ${fmtDate(c.접수일)} · 민원인 ${c.민원인} · ${c.내용}`);
  })();
  const openComplaints = complaints.filter((c) => c.chip !== "처리완료").length;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-1 print:grid-cols-4 print:grid-rows-1" aria-label={`${report.이름} 점유자별 리포트`}>
      <div className="flex min-h-0 min-w-0 flex-col gap-3 [&>section]:min-h-0 [&>section]:flex-1">
        <ReportCard title="요약" source="가상">
          <dl className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1.5">
            <dt className="text-zinc-500">점유 필지</dt>
            <dd>
              {totals.parcels}건 · 점유면적 합계 {fmtArea(Math.round(totals.area * 10) / 10)}
              <span className={parcels.some((p) => p.chip === "무단점유") ? "block font-medium text-red-700" : "block text-zinc-500"}>
                무단점유 {parcels.filter((p) => p.chip === "무단점유").length}건
              </span>
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
              점유 필지 기준 {complaints.length}건
              <span className={openComplaints ? "block font-medium text-red-700" : "block text-zinc-500"}>미완료 {openComplaints}건</span>
            </dd>
          </dl>
        </ReportCard>

        <ReportCard title="안내">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[15px] text-zinc-700">
            <li>
              <SourceBadge source="가상" /> 점유자·민원인 이름은 모두 지어낸 가상 이름(실존 인물과 무관)이며, <b>같은 이름을 같은 점유자</b>로 묶었습니다.
            </li>
            <li>
              각 칸은 <Chip tone="red">무단점유·미납·미완료</Chip>
              <Chip tone="amber">일부납부·처리중</Chip>
              <Chip tone="green">대부 유효·완납·처리완료</Chip> 순으로 급한 것부터 정렬했습니다.
            </li>
            <li>주의사항·관리방안은 AI가 아니라 코드의 규칙(미납 변상금, 무단점유, 만료 임박 계약)으로 만들며 근거 조문을 함께 표시합니다. 민원은 필지 기준 자료입니다. 담당자의 판단을 돕는 참고용입니다.</li>
          </ul>
        </ReportCard>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3 [&>section]:min-h-0 [&>section]:flex-1">
        <ReportCard title="점유 필지" count={`${rows.length}건`} source="가상" detail={<DetailLines lines={lines(parcels)} />}>
          <ItemList items={parcels} title="점유 필지" detail={<DetailLines lines={lines(parcels)} />} />
        </ReportCard>

        <ReportCard title="민원 (점유 필지)" count={complaints.length ? `${complaints.length}건${openComplaints ? ` · 미완료 ${openComplaints}` : ""}` : NONE} source={complaints.length ? "가상" : null} detail={<DetailLines lines={fullComplaints} />}>
          <ItemList items={complaints} title="민원 (점유 필지)" detail={<DetailLines lines={fullComplaints} />} single />
        </ReportCard>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3 [&>section]:min-h-0 [&>section]:flex-1">
        <ReportCard title="대부계약" count={leases.length ? `${leases.length}건` : NONE} source={leases.length ? "가상" : null} detail={<DetailLines lines={lines(leases)} />}>
          <ItemList items={leases} title="대부계약" detail={<DetailLines lines={lines(leases)} />} />
        </ReportCard>

        <ReportCard
          title="변상금"
          count={pens.length ? `${pens.length}건${totals.unpaidCount ? ` · 미납 ${totals.unpaidCount}` : ""}` : NONE}
          source={pens.length ? "가상" : null}
          detail={<DetailLines lines={lines(pens)} />}
        >
          <ItemList items={pens} title="변상금" detail={<DetailLines lines={lines(pens)} />} />
        </ReportCard>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3 [&>section]:min-h-0 [&>section]:flex-1">
        <ReportCard title="주의사항" count={`${report.cautions.length}건`}>
          <ul className="flex flex-col gap-1.5 text-[15px]">
            {report.cautions.map((c, i) => (
              <li key={i} className="break-words">
                {c.text}
                <Cites s={c} />
              </li>
            ))}
          </ul>
        </ReportCard>

        <ReportCard title="관리방안">
          <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-[15px]">
            {report.plan.map((c, i) => (
              <li key={i} className="break-words">
                {c.text}
                <Cites s={c} />
              </li>
            ))}
          </ol>
        </ReportCard>
      </div>
    </div>
  );
}
