// Design Ref: §2 — 점유자별 리포트 페이지(/occupant/이름). 필지별 리포트와 같은 한 장 구성(화면 한 장, A4 한 장).
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import OccupantReport from "@/app/components/OccupantReport";
import PrintButton from "@/app/components/PrintButton";
import { getOccupantReportView } from "@/lib/occupants";

async function Section({ params }: { params: PageProps<"/occupant/[name]">["params"] }) {
  const { name: raw } = await params;
  await connection(); // 오늘 날짜(만료 임박 계산)를 쓰므로 요청 때마다 만든다
  let name = "";
  try {
    name = decodeURIComponent(raw).slice(0, 20);
  } catch {
    name = "";
  }
  const report = name ? getOccupantReportView(name) : null;

  return (
    <main className="mx-auto flex w-full max-w-[1800px] min-h-0 flex-1 flex-col gap-3 px-4 py-3">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-2xl font-bold tracking-tight">점유자별 리포트</h1>
        <Link href="/" className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:border-blue-600 hover:text-blue-700 print:hidden">
          ← 필지별 리포트
        </Link>
      </header>
      {report ? (
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
      ) : (
        <p role="alert" className="max-w-3xl rounded-md border border-zinc-300 bg-white px-4 py-3">
          해당 점유자의 자료가 없습니다.{" "}
          <Link href="/" className="text-blue-700 underline">
            필지별 리포트
          </Link>
          에서 점유자별 리포트 버튼을 눌러 주세요.
        </p>
      )}
    </main>
  );
}

export default function OccupantPage({ params }: PageProps<"/occupant/[name]">) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 xl:h-dvh xl:overflow-hidden print:h-[194mm] print:min-h-0 print:overflow-hidden">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900" role="note">
        가상 데이터 포함 · 점유자 이름은 마스킹된 가상 이름입니다 · 담당자의 판단을 돕는 참고용입니다
      </div>
      <Suspense fallback={<div className="px-4 py-3 text-2xl font-bold">점유자별 리포트</div>}>
        <Section params={params} />
      </Suspense>
    </div>
  );
}
