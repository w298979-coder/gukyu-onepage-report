// Design Ref: §3.2 — "관계법령상 제한" 검토. VWORLD가 알려 준 용도지역·지구·구역 이름을 관계법령과 이어
// (data/law/related-map.json), 그 법령 조문(data/law/related/, 국가법령정보센터 Open API)에서 확인한 국유재산 매각·양도 제한을 보여 준다.
// AI를 쓰지 않고 코드가 정한다. 데이터는 인자로 받아 시험할 수 있게 한다.
import type { LawArticle } from "./types";

export type RelatedVerdict = "제한 있음" | "조건부 확인 필요" | "제한 확인되지 않음";
/** 구역 전체를 합친 표시. "확인 필요"는 용도지역 정보가 없거나 법령과 이어 보지 못한 구역이 있을 때 */
export type RelatedOverall = "제한 있음" | "조건부 확인 필요" | "확인 필요" | "확인된 제한 없음";

export interface RelatedZoneDef {
  이름: string;
  /** 구역 이름과 맞춰 볼 정규식 문자열 */
  일치: string[];
  법령: string;
  판정: RelatedVerdict;
  조문: string[];
  제한내용: string;
  비고?: string;
  참고조문?: string[];
}

export interface RelatedCitation {
  id: string;
  label: string;
  url: string;
}

export interface RelatedItem {
  /** 필지에 지정된 구역 이름(브이월드) 중 이 항목과 이어진 것 */
  구역: string[];
  이름: string;
  법령: string;
  판정: RelatedVerdict;
  제한내용: string;
  비고: string | null;
  citations: RelatedCitation[];
  참고: RelatedCitation[];
}

export interface RelatedResult {
  overall: RelatedOverall;
  /** 브이월드가 알려 준 구역 이름 전체 */
  zones: string[];
  items: RelatedItem[];
  /** 관계법령과 이어 보지 못한 구역 이름 */
  unreviewed: string[];
}

const cite = (a: LawArticle): RelatedCitation => ({ id: a.id, label: `${a.문서명} ${a.조문번호}`, url: a.출처주소 });

const RANK: Record<RelatedVerdict, number> = { "제한 있음": 0, "조건부 확인 필요": 1, "제한 확인되지 않음": 2 };

export function reviewRelated(zones: string[] | null | undefined, defs: RelatedZoneDef[], articles: Map<string, LawArticle>): RelatedResult {
  const names = [...new Set((zones ?? []).filter((z) => typeof z === "string" && z.trim() !== ""))];
  const byDef = new Map<RelatedZoneDef, string[]>();
  const unreviewed: string[] = [];
  for (const n of names) {
    const def = defs.find((d) => d.일치.some((r) => new RegExp(r).test(n)));
    if (!def) unreviewed.push(n);
    else byDef.set(def, [...(byDef.get(def) ?? []), n]);
  }
  const lookup = (ids: string[] | undefined) => (ids ?? []).flatMap((id) => (articles.has(id) ? [cite(articles.get(id)!)] : []));
  const items: RelatedItem[] = [...byDef.entries()]
    .map(([d, zs]) => ({
      구역: zs,
      이름: d.이름,
      법령: d.법령,
      판정: d.판정,
      제한내용: d.제한내용,
      비고: d.비고 ?? null,
      citations: lookup(d.조문),
      참고: lookup(d.참고조문),
    }))
    .sort((a, b) => RANK[a.판정] - RANK[b.판정]);

  let overall: RelatedOverall;
  if (names.length === 0 || unreviewed.length > 0) overall = items.some((i) => i.판정 === "제한 있음") ? "제한 있음" : "확인 필요";
  else if (items.some((i) => i.판정 === "제한 있음")) overall = "제한 있음";
  else if (items.some((i) => i.판정 === "조건부 확인 필요")) overall = "조건부 확인 필요";
  else overall = "확인된 제한 없음";
  return { overall, zones: names, items, unreviewed };
}

/** AI에게 알려 줄 한 줄 요약들(제한 있음·조건부만)과 그 근거 조문 id */
export function relatedForPrompt(r: RelatedResult): { lines: string[]; articleIds: string[] } {
  const hits = r.items.filter((i) => i.판정 !== "제한 확인되지 않음");
  return {
    lines: hits.map((i) => `- (${i.판정}) ${i.구역.join(", ")}: ${i.제한내용} [근거 id: ${i.citations.map((c) => c.id).join(", ")}]`),
    articleIds: [...new Set(hits.flatMap((i) => i.citations.map((c) => c.id)))],
  };
}
