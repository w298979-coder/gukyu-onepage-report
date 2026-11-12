"use client";
// Design Ref: §3 — 카드의 "수정·추가". 수정하면 카드의 원래 내용을 덮어쓰고(출처 "수정"), 이전 값은 과거이력의 수정 기록에 남는다.
// 내용은 이 브라우저의 localStorage에 저장한다. 'AI 검토'가 실행되면 현재 수정 내용이 검토를 위해 서버와 OpenAI로 전송된다(수정자 이름은 제외).
import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { addEdit, editHistoryLines, formatTime, getEdits, MAX_NAME, MAX_TEXT, parseStore, STORAGE_KEY, validateEdit } from "@/lib/edits";
import type { EditableItem, Source } from "@/lib/types";
import DetailDialog from "./DetailDialog";
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

/** 저장소의 원본 글(바뀔 때마다 새로 읽힘) */
export function useEditsRaw(): string {
  return useSyncExternalStore(subscribe, getRaw, () => "");
}

function useEdits(parcelId: string, item: EditableItem) {
  const raw = useEditsRaw();
  return useMemo(() => getEdits(parseStore(raw), parcelId, item), [raw, parcelId, item]);
}

/** 카드 머리의 출처 표시: 수정된 항목이면 "수정", 아니면 원래 출처 */
export function EditSource({ parcelId, item, fallback }: { parcelId: string; item: EditableItem; fallback: Source | null }) {
  const edits = useEdits(parcelId, item);
  return <SourceBadge source={edits.length > 0 ? "수정" : fallback} />;
}

/** 카드 본문: 수정 내용이 있으면 원래 내용을 덮어써서 보여주고, 없으면 원래 내용(children)을 보여준다 */
export function EditBody({ parcelId, item, children }: { parcelId: string; item: EditableItem; children: ReactNode }) {
  const edits = useEdits(parcelId, item);
  const cur = edits.at(-1);
  if (!cur) return <>{children}</>;
  return (
    <div data-edit-note>
      <p className="line-clamp-5 whitespace-pre-wrap break-words">{cur.값}</p>
      <p className="mt-1 text-xs text-zinc-500">
        수정자 {cur.수정자} · {formatTime(cur.수정시각)} · 원래 값은 과거이력에서 확인
      </p>
    </div>
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

/** 카드 머리의 "과거이력" 버튼: 기존 과거이력과 수정 기록을 합친 건수를 버튼에 적는다 */
export function HistoryButton({
  parcelId,
  item,
  title,
  baseCount,
  source,
  children,
}: {
  parcelId: string;
  item: EditableItem;
  title: string;
  /** 서버가 계산한 기존 과거이력 건수 */
  baseCount: number;
  source: Source | null;
  children: ReactNode;
}) {
  const edits = useEdits(parcelId, item);
  const total = baseCount + edits.length;
  return (
    <DetailDialog title={title} label="과거이력" source={source} buttonLabel={total > 0 ? `과거이력 ${total}건` : "과거이력 없음"} tone={total > 0 ? "has" : "none"}>
      {children}
    </DetailDialog>
  );
}

/** 카드 맨 아래 줄: 수정·추가 버튼 */
export function EditFooter({ parcelId, item, title, original, left }: { parcelId: string; item: EditableItem; title: string; original: string; left?: ReactNode }) {
  const edits = useEdits(parcelId, item);
  return (
    <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-4 py-1.5 text-sm">
      <div>{left}</div>
      <EditButton parcelId={parcelId} item={item} title={title} current={edits.at(-1)?.값 ?? ""} original={original} />
    </div>
  );
}

function EditButton({
  parcelId,
  item,
  title,
  current,
  original,
}: {
  parcelId: string;
  item: EditableItem;
  title: string;
  current: string;
  original: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const open = () => {
    setText(current);
    // 저장소를 쓸 수 없으면 창을 열 때 미리 알린다
    let writable = true;
    try {
      window.localStorage.setItem("onboard-probe", "1");
      window.localStorage.removeItem("onboard-probe");
    } catch {
      writable = false;
    }
    setError(writable ? "" : "이 브라우저에서는 저장할 수 없습니다(저장소 사용이 막혀 있음).");
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
      const store = addEdit(parseStore(getRaw()), parcelId, item, { 값: r.값, 수정자: r.수정자, 수정시각: new Date().toISOString() }, original);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      setError("이 브라우저에서는 저장할 수 없습니다(저장소 사용이 막혀 있거나 가득 참).");
      return;
    }
    listeners.forEach((fn) => fn());
    ref.current?.close();
  };

  const clearAll = () => {
    if (!window.confirm("이 브라우저에 저장된 모든 수정·추가 내용을 지울까요? 되돌릴 수 없습니다.")) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 저장소를 쓸 수 없으면 지울 것도 없다 */
    }
    listeners.forEach((fn) => fn());
    ref.current?.close();
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded border border-violet-300 bg-white px-2.5 py-0.5 text-sm font-medium text-violet-800 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-300 print:hidden"
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
            실제 개인정보(실명·연락처·주민등록번호 등)를 입력하지 마세요. 입력한 내용은 이 브라우저에 저장되며, 다른 사람의 화면에는 보이지 않습니다. 단, 화면이 열릴 때 실행되는 AI 검토에는
            수정 내용(수정자 이름 제외)이 서버와 OpenAI(외부 서비스)로 전송됩니다.
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-medium">내용 (최대 {MAX_TEXT}자) — 저장하면 카드의 원래 내용을 대신합니다</span>
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
          <p className="text-zinc-500">저장하면 카드에 &quot;수정&quot; 출처로 표시되고, 이전 내용은 과거이력의 수정 기록에 남습니다.</p>
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={clearAll} className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50">
              이 브라우저의 수정 기록 모두 지우기
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => ref.current?.close()} className="rounded px-3 py-1 text-zinc-600 hover:bg-zinc-100">
                취소
              </button>
              <button type="submit" className="rounded bg-violet-700 px-3 py-1 font-medium text-white hover:bg-violet-800">
                저장
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
