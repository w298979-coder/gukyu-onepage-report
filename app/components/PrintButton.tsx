"use client";
// Design Ref: §2 — 문서 출력. 브라우저 인쇄 창을 열고, 인쇄 때만 보이는 출력일을 함께 적는다. 인쇄 모양은 globals.css 의 @media print 가 정한다.
import { useSyncExternalStore } from "react";

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const noop = () => () => {};

export default function PrintButton() {
  const date = useSyncExternalStore(noop, today, () => "");
  return (
    <>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:border-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 print:hidden"
      >
        A4 출력
      </button>
      <span className="hidden print:inline">· 출력일 {date}</span>
    </>
  );
}
