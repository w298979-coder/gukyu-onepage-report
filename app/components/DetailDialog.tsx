"use client";
// Design Ref: §2 — "세부확인" 버튼. 누르면 카드의 세부 내역 전체를 창으로 보여준다.
// 창 안의 내용은 서버에서 만들어 children으로 받으므로, 브라우저로 따로 데이터를 가져오지 않는다.
import { useRef, type ReactNode } from "react";

export default function DetailDialog({ title, children }: { title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-sm font-medium text-zinc-700 hover:border-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        세부확인
      </button>
      <dialog
        ref={ref}
        aria-label={`${title} 세부 내역`}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close(); // 바깥(어두운 부분)을 누르면 닫기
        }}
        className="m-auto w-[min(40rem,92vw)] rounded-lg border border-zinc-300 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            닫기
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto px-5 py-4 text-sm leading-6">{children}</div>
      </dialog>
    </>
  );
}
