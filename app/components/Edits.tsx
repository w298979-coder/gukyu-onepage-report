"use client";
// Design Ref: §3 — 카드의 "수정·추가". 내용은 이 브라우저의 localStorage에만 저장하고(서버·DB로 보내지 않음),
// 수정할 때마다 기록을 쌓아 이전 값을 과거이력에 남긴다.
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { addEdit, editHistoryLines, formatTime, getEdits, MAX_NAME, MAX_TEXT, parseStore, STORAGE_KEY, validateEdit } from "@/lib/edits";
import type { EditableItem } from "@/lib/types";
import SourceBadge from "./SourceBadge";

// ---- 저장소 구독 (같은 탭의 여러 카드가 함께 갱신되도록 직접 알림을 보낸다) ----
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn); // 다른 탭에서 바뀐 경우
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};
const getRaw = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return ""; // 저장소를 쓸 수 없는 브라우저
  }
};

function useEdits(parcelId: string, item: EditableItem) {
  const raw = useSyncExternalStore(subscribe, getRaw, () => "");
  return useMemo(() => getEdits(parseStore(raw), parcelId, item), [raw, parcelId, item]);
}

/** 카드 본문 아래에 보여 줄 현재 수정 내용 */
export function EditNote({ parcelId, item }: { parcelId: string; item: EditableItem }) {
  const edits = useEdits(parcelId, item);
  const cur = edits.at(-1);
  if (!cur) return null;
  return (
    <p className="mt-2 border-t border-dashed border-zinc-300 pt-2" data-edit-note>
      <SourceBadge source="수정" />
      <span className="line-clamp-2 break-words align-middle">{cur.값}</span>
      <span className="block text-xs text-zinc-500">
        수정자 {cur.수정자} · {formatTime(cur.수정시각)}
      </span>
    </p>
  );
}

/** 과거이력 창에 붙는 수정 기록 */
export function EditHistory({ parcelId, item }: { parcelId: string; item: EditableItem }) {
  const edits = useEdits(parcelId, item);
  if (edits.length === 0) return <p className="mt-1.5 text-zinc-500">수정 기록: 해당 없음</p>;
  return (
    <div className="mt-3 border-t border-zinc-200 pt-3">
      <p className="mb-1.5 font-medium">수정 기록 ({edits.length}건)</p>
      <ul className="flex flex-col gap-1.5">
        {editHistoryLines(edits).map((l, i) => (
          <li key={i} className="whitespace-pre-wrap break-words">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 카드 맨 아래 줄: 과거이력 유무(수정 기록 포함)와 수정·추가 버튼 */
export function CardFooter({
  parcelId,
  item,
  title,
  baseHistoryCount,
}: {
  parcelId: string;
  item: EditableItem;
  title: string;
  /** 서버가 계산한 기존 과거이력 건수 */
  baseHistoryCount: number;
}) {
  const edits = useEdits(parcelId, item);
  const total = baseHistoryCount + edits.length;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-1.5 text-sm">
      <span className={total > 0 ? "font-medium text-blue-700" : "text-zinc-500"}>
        {total > 0 ? `과거이력 있음 (${total}건)` : "과거이력 없음"}
      </span>
      <EditButton parcelId={parcelId} item={item} title={title} current={edits.at(-1)?.값 ?? ""} />
    </div>
  );
}

function EditButton({ parcelId, item, title, current }: { parcelId: string; item: EditableItem; title: string; current: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const open = () => {
    setText(current);
    setError("");
    ref.current?.showModal();
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const r = validateEdit(text, name);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    try {
      const store = addEdit(parseStore(getRaw()), parcelId, item, { 값: r.값, 수정자: r.수정자, 수정시각: new Date().toISOString() });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      setError("이 브라우저에서는 저장할 수 없습니다(저장소 사용이 막혀 있거나 가득 참).");
      return;
    }
    listeners.forEach((fn) => fn());
    ref.current?.close();
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded border border-violet-300 bg-white px-2.5 py-0.5 text-sm font-medium text-violet-800 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-300"
      >
        수정·추가
      </button>
      <dialog
        ref={ref}
        aria-label={`${title} 수정·추가`}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[min(36rem,92vw)] rounded-lg border border-zinc-300 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/40"
      >
        <form onSubmit={save} className="flex flex-col gap-3 px-5 py-4 text-sm leading-6">
          <h3 className="text-base font-semibold">{title} · 수정·추가</h3>
          <p className="rounded bg-amber-50 px-3 py-2 text-amber-900">
            실제 개인정보(실명·연락처·주민등록번호 등)를 입력하지 마세요. 입력한 내용은 이 브라우저에만 저장되며, 다른 사람의 화면에는 보이지 않습니다.
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">내용 (최대 {MAX_TEXT}자)</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_TEXT}
              rows={5}
              className="rounded border border-zinc-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">수정자 이름</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME}
              className="rounded border border-zinc-300 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>
          <p className="text-zinc-500">저장하면 지금 값은 &quot;수정&quot; 출처로 표시되고, 이전 내용은 과거이력의 수정 기록에 남습니다.</p>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="rounded px-3 py-1 text-zinc-600 hover:bg-zinc-100">
              취소
            </button>
            <button type="submit" className="rounded bg-violet-700 px-3 py-1 font-medium text-white hover:bg-violet-800">
              저장
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
