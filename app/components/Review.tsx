"use client";
// Design Ref: §3.2 — 매각가능여부 검토 칸과 제한사항·관리방안 칸.
// 필지 화면이 열리면 자동으로 /api/review 를 불러 판정·관리방안·주의사항을 채우고, 수정 내용이 바뀌면 다시 검토한다.
// 제한 조항은 서버(코드)가 고른 것을 처음부터 보여준다. 수정자 이름은 서버로 보내지 않는다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EDITABLE_ITEMS } from "@/lib/types";
import { getEdits, parseStore } from "@/lib/edits";
import type { RestrictionView, ReviewResult, ReviewSentence } from "@/lib/review-core";
import { useEditsRaw } from "./Edits";
import ReportCard from "./ReportCard";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; result: ReviewResult };

interface Ctx {
  state: State;
  run: () => void;
}
const ReviewContext = createContext<Ctx | null>(null);

function useReview(): Ctx {
  const c = useContext(ReviewContext);
  if (!c) throw new Error("ReviewProvider 안에서만 쓸 수 있습니다");
  return c;
}

/** 두 칸이 같은 검토 결과를 보도록 감싸는 부분. 화면이 열릴 때와 수정 내용이 바뀔 때 자동으로 검토한다. */
export function ReviewProvider({ parcelId, children }: { parcelId: string; children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const busy = useRef(false);
  const again = useRef(false); // 검토 중에 수정 내용이 바뀌면 끝난 뒤 한 번 더 한다
  const raw = useEditsRaw();

  // 이 필지의 현재 수정 내용(항목별 값). 수정자 이름·시각은 포함하지 않는다.
  const edits = useMemo(() => {
    const store = parseStore(raw);
    const out: Record<string, string> = {};
    for (const item of EDITABLE_ITEMS) {
      const cur = getEdits(store, parcelId, item).at(-1);
      if (cur) out[item] = cur.값;
    }
    return out;
  }, [raw, parcelId]);
  const editsKey = JSON.stringify(edits);
  const latestKey = useRef(editsKey); // 가장 최근 수정 내용(검토를 시작할 때 읽는다)

  const run = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        setState({ kind: "loading" });
        try {
          const res = await fetch("/api/review", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ parcelId, edits: JSON.parse(latestKey.current) }),
          });
          const body = (await res.json().catch(() => null)) as (ReviewResult & { error?: string }) | null;
          if (!res.ok || !body || body.error) setState({ kind: "error", message: body?.error ?? "검토 중 오류가 발생했습니다." });
          else setState({ kind: "done", result: body });
        } catch {
          setState({ kind: "error", message: "서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요." });
        }
      } while (again.current); // 검토 중에 수정 내용이 바뀌었으면 한 번 더 한다
    } finally {
      busy.current = false;
    }
  }, [parcelId]);

  useEffect(() => {
    latestKey.current = editsKey;
    void run();
  }, [run, editsKey]);

  return <ReviewContext.Provider value={{ state, run }}>{children}</ReviewContext.Provider>;
}

const VERDICT_STYLE = {
  가능: "bg-emerald-100 text-emerald-900",
  불가: "bg-red-100 text-red-900",
  "추가 확인 필요": "bg-amber-100 text-amber-900",
} as const;

function Cites({ s }: { s: ReviewSentence }) {
  return (
    <span className="ml-1 text-xs text-zinc-500">
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

function SentenceList({ title, items }: { title: string; items: ReviewSentence[] }) {
  return (
    <div className="mb-3">
      <p className="mb-1 font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-zinc-500">해당 없음 ({`근거 자료에서 확인되지 않았습니다`})</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((s, i) => (
            <li key={i} className="break-words">
              {s.text}
              <Cites s={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RestrictionList({ items }: { items: RestrictionView[] }) {
  if (items.length === 0) return <p className="text-zinc-500">해당 없음</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((r, i) => (
        <li key={i} className="break-words">
          <span className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{r.대상}</span>
          {r.제한내용}
          <span className="ml-1 text-xs">
            <a href={r.citation.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
              {r.citation.label}
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}

const REFERENCE_NOTE = "AI가 저장된 법령·내규에서 찾은 근거로 만든 참고용 검토입니다. 최종 판단은 담당자가 합니다.";

/** 매각가능여부 검토 칸 */
export function VerdictCard() {
  const { state, run } = useReview();

  if (state.kind !== "done") {
    return (
      <ReportCard title="매각가능여부 검토">
        {state.kind === "error" ? (
          <>
            <p role="alert" className="text-red-700">
              {state.message}
            </p>
            <p className="mt-1 text-zinc-600">제한사항은 오른쪽 아래 칸에서 그대로 확인할 수 있습니다.</p>
            <button
              type="button"
              onClick={run}
              className="mt-3 rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 print:hidden"
            >
              다시 시도
            </button>
          </>
        ) : (
          <p className="text-zinc-600">저장된 법령·내규를 근거로 AI가 매각가능여부를 검토하는 중입니다… (최대 30초) 참고용이며 근거가 확인되지 않으면 &quot;추가 확인 필요&quot;로 표시합니다.</p>
        )}
      </ReportCard>
    );
  }

  const r = state.result;
  const first = r.verdictReasons[0];
  return (
    <ReportCard
      title="매각가능여부 검토"
      detail={
        <>
          <p className="mb-3 text-zinc-600">{REFERENCE_NOTE}</p>
          <p className="mb-3">
            판정: <span className={`rounded px-2 py-0.5 font-semibold ${VERDICT_STYLE[r.verdict]}`}>{r.verdict}</span>
          </p>
          {r.verdictNote && <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-amber-900">{r.verdictNote}</p>}
          <SentenceList title="판정 이유와 근거" items={r.verdictReasons} />
          {r.hidden > 0 && <p className="text-xs text-zinc-500">근거를 확인하지 못해 숨긴 문장: {r.hidden}건</p>}
        </>
      }
    >
      <p>
        <span className={`rounded px-2 py-0.5 font-semibold ${VERDICT_STYLE[r.verdict]}`}>{r.verdict}</span>
        <span className="ml-1 text-xs text-zinc-500">AI 검토 · 참고용</span>
      </p>
      <p className="mt-2 line-clamp-3 break-words">
        {first ? (
          <>
            {first.text}
            <Cites s={first} />
          </>
        ) : (
          r.verdictNote ?? "근거 자료에서 확인되지 않았습니다"
        )}
      </p>
    </ReportCard>
  );
}

/** 대부·처분 제한사항 / 관리방안 칸. 제한 조항은 서버가 고른 것을 처음부터 보여준다. */
export function ManagementCard({ restrictions, missing }: { restrictions: RestrictionView[]; missing: { 문서명: string; 사유: string }[] }) {
  const { state } = useReview();
  const result = state.kind === "done" ? state.result : null;
  const list = result ? result.restrictions : restrictions;
  const count = (k: RestrictionView["대상"]) => list.filter((r) => r.대상 === k).length;
  const mgmt = result?.management[0];

  return (
    <ReportCard
      title="대부·처분 제한사항 / 관리방안"
      count={`제한 ${list.length}건`}
      detail={
        <>
          <p className="mb-3 text-zinc-600">제한사항은 이 필지의 상태·지목에 맞는 조항을 앱이 저장된 법령·내규에서 고른 것입니다. 요약이므로 업무에 쓰기 전에 원문을 확인하세요.</p>
          <p className="mb-1 font-medium">대부·처분 제한사항 ({list.length}건)</p>
          <div className="mb-4">
            <RestrictionList items={list} />
          </div>
          <div className="mb-4 rounded bg-zinc-50 px-3 py-2">
            <p className="mb-1 font-medium">근거 자료에서 확인하지 못한 문서 ({missing.length}건)</p>
            {missing.length === 0 ? (
              <p className="text-zinc-500">해당 없음</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {missing.map((d) => (
                  <li key={d.문서명} className="break-words">
                    {d.문서명} — <span className="text-zinc-600">{d.사유}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {result ? (
            <>
              <SentenceList title="종합 관리방안 (AI 검토 · 참고용)" items={result.management} />
              <SentenceList title="주의사항 (AI 검토 · 참고용)" items={result.cautions} />
            </>
          ) : (
            <p className="text-zinc-500">관리방안과 주의사항은 AI 검토가 끝나면 표시됩니다.</p>
          )}
        </>
      }
    >
      <p className="text-zinc-700">
        대부 {count("대부")}건 · 처분 {count("처분")}건 · 관리 {count("관리")}건
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {list.slice(0, 2).map((r, i) => (
          <li key={i} className="line-clamp-2 break-words">
            <span className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{r.대상}</span>
            {r.제한내용}
            <span className="ml-1 text-xs text-zinc-500">[{r.citation.label}]</span>
          </li>
        ))}
      </ul>
      {result ? (
        <p className="mt-2 line-clamp-2 break-words text-zinc-800">
          <span className="font-medium">관리방안:</span> {mgmt ? mgmt.text : "근거 자료에서 확인되지 않았습니다"}
          {mgmt && <Cites s={mgmt} />}
          {result.cautions.length > 0 && <span className="text-zinc-500"> · 주의사항 {result.cautions.length}건</span>}
        </p>
      ) : (
        <p className="mt-2 text-zinc-500">
          {state.kind === "error" ? "관리방안·주의사항: AI 검토를 불러오지 못했습니다" : "관리방안·주의사항: AI 검토 중…"}
        </p>
      )}
    </ReportCard>
  );
}
