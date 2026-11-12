"use client";
// Design Ref: §3.2 — 매각가능여부 검토 칸과 제한사항·관리방안 칸.
// 필지 화면이 열리면 자동으로 /api/review 를 불러 판정·관리방안·주의사항을 채우고, 수정 내용이 바뀌면 다시 검토한다.
// 제한 조항은 서버(코드)가 고른 것을 처음부터 보여준다. 수정자 이름은 서버로 보내지 않는다.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EDITABLE_ITEMS } from "@/lib/types";
import { getEdits, parseStore } from "@/lib/edits";
import type { RelatedOverall, RelatedResult } from "@/lib/related-core";
import type { RestrictionView, ReviewResult, ReviewSentence } from "@/lib/review-core";
import { useEditsRaw } from "./Edits";
import MoreItems from "./MoreItems";
import ReportCard from "./ReportCard";
import SourceBadge from "./SourceBadge";

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

const RELATED_STYLE: Record<RelatedOverall, string> = {
  "제한 있음": "bg-red-100 text-red-900",
  "조건부 확인 필요": "bg-amber-100 text-amber-900",
  "확인 필요": "bg-amber-100 text-amber-900",
  "확인된 제한 없음": "bg-emerald-100 text-emerald-900",
};
const ITEM_STYLE = {
  "제한 있음": "bg-red-100 text-red-900",
  "조건부 확인 필요": "bg-amber-100 text-amber-900",
  "제한 확인되지 않음": "bg-emerald-100 text-emerald-900",
} as const;

/** 관계법령상 제한 한 줄 요약 */
function relatedSummary(r: RelatedResult): string {
  const hits = r.items.filter((i) => i.판정 !== "제한 확인되지 않음");
  if (r.zones.length === 0) return "브이월드에서 용도지역·지구·구역 정보를 받지 못해 확인하지 못했습니다";
  if (hits.length === 0) return `지정 구역 ${r.zones.length}개를 관계법령에서 검토했고 매각·양도 제한 조항은 확인되지 않았습니다`;
  return hits.map((i) => `${i.구역.join("·")}: ${i.citations.map((c) => c.label).join(", ") || i.법령}`).join(" / ");
}

function RelatedDetail({ related }: { related: RelatedResult }) {
  return (
    <div className="mb-4">
      <h4 className="mb-1 font-semibold">
        관계법령상 제한 <span className={`ml-1 rounded px-2 py-0.5 text-sm font-semibold ${RELATED_STYLE[related.overall]}`}>{related.overall}</span>
      </h4>
      <p className="mb-2 text-xs text-zinc-600">
        브이월드의 용도지역·지구·구역 지정내역으로 관계법령(국가법령정보센터)에서 국유재산 처분(매각·양도) 제한을 확인한 결과입니다. 법령 조문을 읽고 정리한 것이므로 업무에 쓰기 전에 원문을 확인하세요.
      </p>
      <p className="mb-2">
        <span className="font-medium">지정 구역</span> <SourceBadge source="브이월드" /> {related.zones.length ? related.zones.join(", ") : "해당 없음"}
      </p>
      {related.unreviewed.length > 0 && <p className="mb-2 text-amber-800">관계법령과 이어 보지 못한 구역: {related.unreviewed.join(", ")} (추가 확인 필요)</p>}
      <ul className="flex flex-col gap-2">
        {related.items.map((i) => (
          <li key={i.이름} className="rounded border border-zinc-200 px-3 py-2">
            <p>
              <span className={`mr-1 rounded px-1.5 py-0.5 text-xs font-semibold ${ITEM_STYLE[i.판정]}`}>{i.판정}</span>
              <span className="font-medium">{i.구역.join(", ")}</span> <span className="text-xs text-zinc-500">· {i.법령}</span>
            </p>
            <p className="mt-1 break-words">{i.제한내용}</p>
            {i.비고 && <p className="mt-1 break-words text-zinc-600">참고: {i.비고}</p>}
            {(i.citations.length > 0 || i.참고.length > 0) && (
              <p className="mt-1 text-xs">
                {[...i.citations.map((c) => ({ ...c, 참고: false })), ...i.참고.map((c) => ({ ...c, 참고: true }))].map((c, k) => (
                  <span key={c.id}>
                    {k > 0 && ", "}
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                      {c.label}
                    </a>
                    {c.참고 && <span className="text-zinc-500"> (참고)</span>}
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const DISPOSAL_BASIS = "국유재산법·시행령·시행규칙·세칙·요강·기준";

/** 매각가능여부 검토 칸: 관계법령상 제한(코드가 확인)과 처분기준상 제한(AI 검토)으로 나눠 보여 준다 */
export function VerdictCard({ related }: { related: RelatedResult }) {
  const { state, run } = useReview();
  const relBlock = (
    <div>
      <p className="text-sm font-semibold text-zinc-700">
        관계법령상 제한 <SourceBadge source="브이월드" />
      </p>
      <p className="mt-0.5">
        <span className={`rounded px-2 py-0.5 font-semibold ${RELATED_STYLE[related.overall]}`}>{related.overall}</span>
      </p>
      <p className="mt-1 line-clamp-2 break-words text-sm text-zinc-700">{relatedSummary(related)}</p>
    </div>
  );
  const sectionTitle = (
    <p className="text-sm font-semibold text-zinc-700">
      처분기준상 제한 <span className="font-normal text-zinc-500">({DISPOSAL_BASIS} 검토)</span>
    </p>
  );

  if (state.kind !== "done") {
    return (
      <ReportCard title="매각가능여부 검토" detail={<RelatedDetail related={related} />}>
        {relBlock}
        <div className="mt-2 border-t border-zinc-200 pt-2">
          {sectionTitle}
          {state.kind === "error" ? (
            <>
              <p role="alert" className="mt-1 text-red-700">
                {state.message}
              </p>
              <button type="button" onClick={run} className="mt-1 rounded bg-blue-700 px-3 py-1 text-sm font-medium text-white hover:bg-blue-800 print:hidden">
                다시 시도
              </button>
            </>
          ) : (
            <p className="mt-1 text-zinc-600">AI가 저장된 법령·내규를 근거로 검토하는 중입니다… (최대 30초)</p>
          )}
        </div>
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
          <RelatedDetail related={related} />
          <div className="border-t border-zinc-200 pt-3">
            <h4 className="mb-1 font-semibold">
              처분기준상 제한 <span className="text-sm font-normal text-zinc-500">({DISPOSAL_BASIS} 검토)</span>
            </h4>
            <p className="mb-3 text-zinc-600">{REFERENCE_NOTE}</p>
            <p className="mb-3">
              판정: <span className={`rounded px-2 py-0.5 font-semibold ${VERDICT_STYLE[r.verdict]}`}>{r.verdict}</span>
            </p>
            {r.verdictNote && <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-amber-900">{r.verdictNote}</p>}
            <SentenceList title="판정 이유와 근거" items={r.verdictReasons} />
            {r.hidden > 0 && <p className="text-xs text-zinc-500">근거를 확인하지 못해 숨긴 문장: {r.hidden}건</p>}
          </div>
        </>
      }
    >
      {relBlock}
      <div className="mt-2 border-t border-zinc-200 pt-2">
        {sectionTitle}
        <p className="mt-0.5">
          <span className={`rounded px-2 py-0.5 font-semibold ${VERDICT_STYLE[r.verdict]}`}>{r.verdict}</span>
          <span className="ml-1 text-xs text-zinc-500">AI 검토 · 참고용</span>
        </p>
        <p className="mt-1 line-clamp-2 break-words text-sm">
          {first ? (
            <>
              {first.text}
              <Cites s={first} />
            </>
          ) : (
            r.verdictNote ?? "근거 자료에서 확인되지 않았습니다"
          )}
        </p>
      </div>
    </ReportCard>
  );
}

/** 관리방안 칸: 점유자·대부계약·변상금·민원·관리 메모 현황을 법령·내규에 비추어 검토해 주의할 점까지 합친 단답식 관리방안 */
export function ManagementCard({
  restrictions,
  missing,
  memo,
  related,
}: {
  related: RelatedResult;
  restrictions: RestrictionView[];
  missing: { 문서명: string; 사유: string }[];
  /** 기타 관리 메모(가상). AI 검토가 끝나기 전에는 이 내용을 보여 준다 */
  memo: string | null;
}) {
  const { state } = useReview();
  const result = state.kind === "done" ? state.result : null;
  const list = result ? result.restrictions : restrictions;
  // 관계법령상 제한이 있는 구역 중 근거 조문이 있는 것만 보인다(조문 없는 문장은 보이지 않는다)
  const relatedWithBasis = related.items.filter((i) => i.판정 !== "제한 확인되지 않음" && i.citations.length > 0);

  const detail = (
    <>
      <p className="mb-3 text-zinc-600">
        점유자·대부계약·변상금·민원·관리 메모 현황을 국유재산법령·내규에 비추어 검토하고, 주의할 점과 비슷하거나 겹치는 내용은 한 항목으로 합친 관리방안입니다. {REFERENCE_NOTE}
      </p>
      {memo && (
        <p className="mb-3 rounded bg-zinc-50 px-3 py-2">
          <span className="font-medium">관리 메모</span> <SourceBadge source="가상" /> {memo}
        </p>
      )}
      {result ? <SentenceList title="관리방안 (효율적인 순서)" items={result.management} /> : <p className="mb-3 text-zinc-500">관리방안은 AI 검토가 끝나면 표시됩니다.</p>}
      <div className="mt-4 border-t border-zinc-200 pt-3">
        <p className="mb-1 font-medium">이 필지에 적용되는 대부·처분·관리 제한 조항 ({list.length}건)</p>
        <p className="mb-2 text-xs text-zinc-600">필지 상태·지목·현황 항목에 맞는 조항을 앱이 저장된 법령·내규에서 고른 것입니다. 요약이므로 업무에 쓰기 전에 원문을 확인하세요.</p>
        <RestrictionList items={list} />
      </div>
      <div className="mt-4 rounded bg-zinc-50 px-3 py-2">
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
    </>
  );

  return (
    <ReportCard title="관리방안" detail={detail}>
      {/* 매각가능여부와 사유(간결) */}
      <p className="mb-2 border-b border-zinc-200 pb-2 text-sm">
        <span className="font-semibold text-zinc-700">매각가능여부</span>{" "}
        {result ? (
          <>
            <span className={`rounded px-1.5 py-0.5 font-semibold ${VERDICT_STYLE[result.verdict]}`}>{result.verdict}</span>
            <span className="ml-1 break-words">
              {result.verdictReasons[0]?.text ?? result.verdictNote ?? "근거 자료에서 확인되지 않았습니다"}
              {result.verdictReasons[0] && <Cites s={result.verdictReasons[0]} />}
            </span>
          </>
        ) : (
          <span className="text-zinc-500">{state.kind === "error" ? "AI 검토를 불러오지 못했습니다" : "AI 검토 중…"}</span>
        )}
        {relatedWithBasis.length > 0 && (
          <span className="mt-0.5 block text-xs">
            <span className={`rounded px-1 py-0.5 font-semibold ${RELATED_STYLE[related.overall]}`}>관계법령 {related.overall}</span>
            {relatedWithBasis.map((i) => (
              <span key={i.이름} className="ml-1 text-zinc-600">
                {i.구역.join("·")}
                <span className="ml-0.5 text-zinc-500">
                  (
                  {i.citations.map((c, k) => (
                    <span key={c.id}>
                      {k > 0 && ", "}
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                        {c.label}
                      </a>
                    </span>
                  ))}
                  )
                </span>
              </span>
            ))}
          </span>
        )}
      </p>
      {result ? (
        result.management.length === 0 ? (
          <p className="text-zinc-500">근거 자료에서 확인되지 않았습니다</p>
        ) : (
          <>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5">
              {result.management.slice(0, 4).map((m, i) => (
                <li key={i} className="break-words">
                  {m.text}
                  <Cites s={m} />
                </li>
              ))}
            </ol>
            <MoreItems title="관리방안" count={result.management.length - 4}>
              <SentenceList title="관리방안 (전체)" items={result.management} />
            </MoreItems>
          </>
        )
      ) : (
        <div className="text-sm">
          <p className="text-zinc-600">{state.kind === "error" ? "관리방안을 불러오지 못했습니다. 적용되는 제한 조항은 세부확인에서 볼 수 있습니다." : "현황을 법령·내규에 비추어 AI가 검토하는 중입니다…"}</p>
          {memo && (
            <p className="mt-2 break-words">
              <span className="font-medium">관리 메모</span> <SourceBadge source="가상" /> {memo}
            </p>
          )}
        </div>
      )}
    </ReportCard>
  );
}
