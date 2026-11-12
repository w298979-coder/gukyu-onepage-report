// Design Ref: §2 — 점유자별 리포트의 서버 쪽: 필지 데이터에서 점유자별로 묶고, 근거 조문 id를 조문 이름·번호·주소로 바꾼다.
import "server-only";
import { ARTICLES } from "./law";
import { buildOccupantReport, listOccupants, type OccupantListItem, type OccupantReport, type Sentence } from "./occupant-core";
import { getParcels } from "./parcels";

export interface CitedSentence {
  text: string;
  citations: { id: string; label: string; url: string }[];
}
export type OccupantReportView = Omit<OccupantReport, "cautions" | "plan"> & { cautions: CitedSentence[]; plan: CitedSentence[] };

const cite = (s: Sentence): CitedSentence => ({
  text: s.text,
  citations: s.articleIds.flatMap((id) => {
    const a = ARTICLES.get(id);
    return a ? [{ id, label: `${a.문서명} ${a.조문번호}`, url: a.출처주소 }] : [];
  }),
});

export function getOccupantList(): OccupantListItem[] {
  return listOccupants(getParcels());
}

export function getOccupantReportView(name: string): OccupantReportView | null {
  const r = buildOccupantReport(getParcels(), name, new Date().toISOString().slice(0, 10));
  return r ? { ...r, cautions: r.cautions.map(cite), plan: r.plan.map(cite) } : null;
}
