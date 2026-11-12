"use client";
// Design Ref: §2 — 기본 정보의 사진 한 칸. 작게 보이다가 누르면 큰 창으로 열린다. 제목 아래에 출처를 적는다.
import { useRef, type ReactNode } from "react";

export default function PhotoFrame({ title, source, children }: { title: string; source: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <figure className="min-w-0">
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="block w-full overflow-hidden rounded border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
        aria-label={`${title} 크게 보기`}
      >
        {children}
      </button>
      <figcaption className="mt-0.5 text-xs text-zinc-600">
        <span className="font-medium">{title}</span> · {source}
      </figcaption>
      <dialog
        ref={ref}
        aria-label={title}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[min(60rem,94vw)] rounded-lg border border-zinc-300 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h3 className="text-base font-semibold">
            {title} <span className="text-sm font-normal text-zinc-500">· {source}</span>
          </h3>
          <button type="button" onClick={() => ref.current?.close()} className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100">
            닫기
          </button>
        </div>
        <div className="p-3">{children}</div>
      </dialog>
    </figure>
  );
}
