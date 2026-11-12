// Design Ref: §2, §3.2 — 지번 입력·조회 화면과 필지별 한 페이지 리포트.
// Plan: 작업 5(조회), 작업 6(리포트). 큰 화면에서는 페이지 전체 스크롤 없이 한 장에 보인다.
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import LookupForm from "./components/LookupForm";
import OccupantView from "./components/OccupantView";
import PrintButton from "./components/PrintButton";
import Report from "./components/Report";
import { findParcels, parseJibun, shortAddress } from "@/lib/jibun";
import { getOccupantList, getOccupantReportView, searchOccupantNames, type OccupantReportView } from "@/lib/occupants";
import { getParcels } from "@/lib/parcels";
import type { Parcel } from "@/lib/types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const NO_DATA = "해당 지번의 자료가 없습니다";
const NO_OCCUPANT = "해당 점유자의 자료가 없습니다";

type SearchParams = PageProps<"/">["searchParams"];

// searchParams를 읽는 부분은 요청마다 달라지므로 Suspense 안에서 처리한다(Next.js cacheComponents 규칙)
async function LookupSection({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = first(sp.q).slice(0, 200); // 너무 긴 입력은 잘라서 다룬다
  const id = first(sp.id);
  const by = first(sp.by) === "occupant" ? "occupant" : "lot";
  const all = getParcels();

  let message: string | null = null;
  let candidates: Parcel[] = [];
  let selected: Parcel | null = null;

  // 점유자로 조회: 이름이 하나로 정해지면 점유자별 리포트를 바로 보여 주고, 여럿이면 고르게 한다.
  // 지번으로 조회했는데 지번이 아니거나 자료가 없고 점유자 이름과 맞으면 점유자 조회로 이어 준다.
  let occupantNames: string[] = [];
  let occupantReport: OccupantReportView | null = null;
  let occupantMode = by === "occupant";

  if (q.trim() !== "" && !occupantMode) {
    const parsed = parseJibun(q);
    if (!parsed.ok) {
      message = parsed.reason;
    } else {
      candidates = findParcels(parsed.query, all);
      if (candidates.length === 0) message = NO_DATA;
      else if (candidates.length === 1) selected = candidates[0];
      else if (id) selected = candidates.find((c) => c.id === id) ?? null; // 조회 결과 안에서만 고를 수 있다
    }
    if (!selected && candidates.length === 0 && searchOccupantNames(q).length > 0) {
      occupantMode = true;
      message = null;
    }
  }
  if (q.trim() !== "" && occupantMode) {
    await connection(); // 오늘 날짜(만료 임박 계산)를 쓰므로 요청 때마다 만든다
    occupantNames = searchOccupantNames(q);
    if (occupantNames.length === 0) message = NO_OCCUPANT;
    else if (occupantNames.length === 1 || occupantNames.includes(id)) occupantReport = getOccupantReportView(occupantNames.length === 1 ? occupantNames[0] : id);
  }

  const examples = [all[0], all[8], all[14], all[21]].filter(Boolean) as Parcel[];
  const occupants = getOccupantList();

  return (
    <main className="mx-auto flex w-full max-w-[1800px] min-h-0 flex-1 flex-col gap-3 px-4 py-3">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight">국유재산 원보드리포트</h1>
        <div className="min-w-0 flex-1 print:hidden"><LookupForm defaultValue={q} defaultBy={occupantMode ? "occupant" : "lot"} /></div>
      </header>

      {!selected && !occupantReport && (
        <p className="text-zinc-600">대전광역시 국유재산의 지번을 입력하면 필지별 종합현황을, 점유자 이름을 입력하면 점유자별 리포트를 한 화면으로 보여줍니다.</p>
      )}

      <section aria-live="polite" className="flex min-h-0 flex-col gap-3">
        {message && (
          <p
            role="alert"
            className={`max-w-3xl rounded-md border px-4 py-3 ${
              message === NO_DATA || message === NO_OCCUPANT ? "border-zinc-300 bg-white text-zinc-800" : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {message}
            {message === NO_DATA && (
              <span className="mt-1 block text-sm text-zinc-600">
                입력한 지번: {q.trim()} · 이 앱은 대전광역시 29건의 실습용 자료만 조회할 수 있어요. 동 이름과 번호를 확인해 주세요.
              </span>
            )}
          </p>
        )}

        {message === NO_OCCUPANT && (
          <p className="max-w-3xl text-sm text-zinc-600">
            입력한 점유자: {q.trim()} · 점유자 이름을 확인해 주세요. 아래 목록에서 고를 수도 있어요.
          </p>
        )}

        {occupantNames.length > 1 && !occupantReport && (
          <div className="flex max-w-3xl flex-col gap-2 rounded-md border border-zinc-300 bg-white p-4">
            <p className="font-semibold">&quot;{q.trim()}&quot;와 맞는 점유자가 {occupantNames.length}명 있습니다. 하나를 선택해 주세요.</p>
            <ul className="flex flex-col gap-2">
              {occupantNames.map((n) => (
                <li key={n}>
                  <Link href={`/?by=occupant&q=${encodeURIComponent(q.trim())}&id=${encodeURIComponent(n)}`} className="block rounded border border-zinc-200 px-3 py-2 hover:border-blue-600 hover:bg-blue-50">
                    {n}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {candidates.length > 1 && !selected && (
          <div className="flex max-w-3xl flex-col gap-2 rounded-md border border-zinc-300 bg-white p-4">
            <p className="font-semibold">같은 번호의 필지가 {candidates.length}건 있습니다. 하나를 선택해 주세요.</p>
            <ul className="flex flex-col gap-2">
              {candidates.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/?q=${encodeURIComponent(q.trim())}&id=${encodeURIComponent(c.id)}`}
                    className="block rounded border border-zinc-200 px-3 py-2 hover:border-blue-600 hover:bg-blue-50"
                  >
                    {c.지번} <span className="text-sm text-zinc-500">· {c.상태}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {occupantReport && <OccupantView report={occupantReport} />}

      {selected && (
        <>
          <p className="text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">{selected.지번}</span> · {selected.상태} · 현재 기준 <PrintButton />
          </p>
          <Report parcel={selected} />
        </>
      )}

      {q.trim() === "" && (
        <section className="flex flex-col gap-2 text-sm text-zinc-600">
          <p>예시로 눌러 보세요.</p>
          <ul className="flex flex-wrap gap-2">
            {examples.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/?q=${encodeURIComponent(shortAddress(p.지번))}`}
                  className="inline-block rounded-full border border-zinc-300 bg-white px-3 py-1 hover:border-blue-600 hover:bg-blue-50"
                >
                  {shortAddress(p.지번)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.trim() === "" && occupants.length > 0 && (
        <section className="flex flex-col gap-2 text-sm text-zinc-600">
          <p>점유자별로 보려면 점유자를 눌러 주세요. (점유자별 리포트 · 가상 데이터)</p>
          <ul className="flex flex-wrap gap-2">
            {occupants.map((o) => (
              <li key={o.이름}>
                <Link
                  href={`/?by=occupant&q=${encodeURIComponent(o.이름)}`}
                  className="inline-block rounded-full border border-blue-300 bg-white px-3 py-1 text-blue-700 hover:border-blue-600 hover:bg-blue-50"
                >
                  {o.이름} · 필지 {o.필지수}건{o.미납변상금수 > 0 ? ` · 미납 ${o.미납변상금수}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 xl:h-dvh xl:overflow-hidden print:h-[194mm] print:min-h-0 print:overflow-hidden">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900" role="note">
        가상 데이터 포함 · 출처: 캠코 국유재산포털, 브이월드 · 담당자의 판단을 돕는 참고용입니다
      </div>
      <Suspense fallback={<div className="px-4 py-3 text-2xl font-bold">국유재산 원보드리포트</div>}>
        <LookupSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
