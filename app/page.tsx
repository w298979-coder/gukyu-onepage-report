// Design Ref: §2, §3.2 — 지번 입력·조회 화면.
// Plan: 작업 5. 지번 표기를 정리해 찾고, 없으면 안내하고, 같은 번호가 여러 건이면 고르게 한다.
// 조회된 필지의 한 페이지 리포트는 작업 6에서 이 자리에 만든다.
import Link from "next/link";
import { Suspense } from "react";
import LookupForm from "./components/LookupForm";
import { findParcels, parseJibun, shortAddress } from "@/lib/jibun";
import { getParcels } from "@/lib/parcels";
import type { Parcel } from "@/lib/types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const NO_DATA = "해당 지번의 자료가 없습니다";

function formatArea(p: Parcel): string {
  const v = p.면적.value;
  return v === null ? "해당 없음" : `${v.toLocaleString("ko-KR")}㎡`;
}

type SearchParams = PageProps<"/">["searchParams"];

// searchParams를 읽는 부분은 요청마다 달라지므로 Suspense 안에서 처리한다(Next.js cacheComponents 규칙)
async function LookupSection({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = first(sp.q).slice(0, 200); // 너무 긴 입력은 잘라서 다룬다
  const id = first(sp.id);
  const all = getParcels();

  let message: string | null = null;
  let candidates: Parcel[] = [];
  let selected: Parcel | null = null;

  if (q.trim() !== "") {
    const parsed = parseJibun(q);
    if (!parsed.ok) {
      message = parsed.reason;
    } else {
      candidates = findParcels(parsed.query, all);
      if (candidates.length === 0) message = NO_DATA;
      else if (candidates.length === 1) selected = candidates[0];
      else if (id) selected = candidates.find((c) => c.id === id) ?? null; // 조회 결과 안에서만 고를 수 있다
    }
  }

  const examples = [all[0], all[8], all[14], all[21]].filter(Boolean) as Parcel[];

  return (
    <>
      <LookupForm defaultValue={q} />

        <section aria-live="polite" className="flex flex-col gap-4">
          {message && (
            <p
              role="alert"
              className={`rounded-md border px-4 py-3 ${
                message === NO_DATA ? "border-zinc-300 bg-white text-zinc-800" : "border-red-300 bg-red-50 text-red-800"
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

          {candidates.length > 1 && !selected && (
            <div className="flex flex-col gap-2 rounded-md border border-zinc-300 bg-white p-4">
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

          {selected && (
            <article className="rounded-md border border-zinc-300 bg-white p-5">
              <h2 className="text-xl font-semibold">{selected.지번}</h2>
              <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
                <dt className="text-zinc-500">구분</dt>
                <dd>{selected.구분}</dd>
                <dt className="text-zinc-500">상태</dt>
                <dd>{selected.상태}</dd>
                <dt className="text-zinc-500">면적</dt>
                <dd>{formatArea(selected)}</dd>
                <dt className="text-zinc-500">지목</dt>
                <dd>{selected.지목.value ?? "해당 없음"}</dd>
              </dl>
              <p className="mt-3 text-xs text-zinc-500">필지별 종합 리포트는 다음 작업에서 이 자리에 만듭니다.</p>
            </article>
          )}
        </section>

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
    </>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900" role="note">
        가상 데이터 포함 · 출처: 캠코 국유재산포털, 브이월드 · 담당자의 판단을 돕는 참고용입니다
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">국유재산 원보드리포트</h1>
          <p className="text-zinc-600">대전광역시 국유재산의 지번을 입력하면 필지별 종합현황을 한 화면으로 보여줍니다.</p>
        </header>

        <Suspense fallback={<LookupForm defaultValue="" />}>
          <LookupSection searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
