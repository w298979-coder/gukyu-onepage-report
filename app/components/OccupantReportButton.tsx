"use client";
// Design Ref: §2 — 필지 리포트의 "점유자별 리포트" 버튼. 점유자가 한 명이면 바로 이동하고, 여럿이면 고르는 창을 연다.
import Link from "next/link";
import { useRef } from "react";

const href = (name: string) => `/occupant/${encodeURIComponent(name)}`;
const BTN =
  "rounded border border-blue-300 bg-white px-2.5 py-0.5 text-sm font-medium text-blue-700 hover:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 print:hidden";

export default function OccupantReportButton({ names }: { names: string[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  if (names.length === 0) return null;
  if (names.length === 1) {
    return (
      <Link href={href(names[0])} className={BTN}>
        점유자별 리포트
      </Link>
    );
  }
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={BTN}>
        점유자별 리포트
      </button>
      <dialog
        ref={ref}
        aria-label="점유자별 리포트 선택"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[min(26rem,92vw)] rounded-lg border border-zinc-300 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h3 className="text-base font-semibold">점유자별 리포트 · 점유자 선택</h3>
          <button type="button" onClick={() => ref.current?.close()} className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100">
            닫기
          </button>
        </div>
        <ul className="flex flex-col gap-2 px-5 py-4 text-sm">
          {names.map((n) => (
            <li key={n}>
              <Link href={href(n)} className="block rounded border border-zinc-200 px-3 py-2 hover:border-blue-600 hover:bg-blue-50">
                {n} <span className="text-zinc-500">· 이 점유자의 모든 필지 보기</span>
              </Link>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
