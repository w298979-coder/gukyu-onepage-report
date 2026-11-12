// Design Ref: §3.2 — 저장된 법령·내규 조문과 제한 조항을 서버에서 읽는다. (브라우저 번들에 넣지 않는다)
import "server-only";
import act from "@/data/law/act.json";
import decree from "@/data/law/decree.json";
import rule from "@/data/law/rule.json";
import farmland from "@/data/law/farmland.json";
import sechik from "@/data/law/sechik.json";
import yogang from "@/data/law/yogang.json";
import disposal from "@/data/law/disposal.json";
import restrictionsRaw from "@/data/law/restrictions.json";
import missingRaw from "@/data/law/missing.json";
import relatedMapRaw from "@/data/law/related-map.json";
import rGaesup from "@/data/law/related/redevelopment.json";
import rPark from "@/data/law/related/park.json";
import rPlan from "@/data/law/related/planning.json";
import rPlanDecree from "@/data/law/related/planning-decree.json";
import rGb from "@/data/law/related/greenbelt.json";
import rWater from "@/data/law/related/waterworks.json";
import rRail from "@/data/law/related/rail-safety.json";
import rRailBuild from "@/data/law/related/rail-build.json";
import rEdu from "@/data/law/related/edu-env.json";
import rHeritage from "@/data/law/related/heritage.json";
import rLandscape from "@/data/law/related/landscape.json";
import rLivestock from "@/data/law/related/livestock.json";
import rAir from "@/data/law/related/air.json";
import rWaterEnv from "@/data/law/related/water-env.json";
import rRoad from "@/data/law/related/road.json";
import rSchool from "@/data/law/related/school.json";
import type { RelatedZoneDef } from "./related-core";
import type { LawArticle, MissingDoc, Restriction } from "./types";

const docs = [act, decree, rule, farmland, sechik, yogang, disposal] as unknown as { articles: LawArticle[] }[];

/** 조문 id → 조문. AI가 인용한 id가 실제로 있는지 확인하는 기준이다. */
export const ARTICLES: Map<string, LawArticle> = new Map(docs.flatMap((d) => d.articles).map((a) => [a.id, a]));

export const RESTRICTIONS = (restrictionsRaw as unknown as { restrictions: Restriction[] }).restrictions;

/** 근거 자료로 쓰기로 했지만 저장하지 못한 문서(화면의 제한사항 세부확인에 '미확인'으로 표시) */
export const MISSING_DOCS = (missingRaw as unknown as { documents: MissingDoc[] }).documents;

const relatedDocs = [rGaesup, rPark, rPlan, rPlanDecree, rGb, rWater, rRail, rRailBuild, rEdu, rHeritage, rLandscape, rLivestock, rAir, rWaterEnv, rRoad, rSchool] as unknown as { articles: LawArticle[] }[];

/** 관계법령 조문(용도지역·지구·구역을 정한 법령). id → 조문 */
export const RELATED_ARTICLES: Map<string, LawArticle> = new Map(relatedDocs.flatMap((d) => d.articles).map((a) => [a.id, a]));

/** 국유재산 관련 조문과 관계법령 조문을 합친 것(AI 인용 검증은 이 목록과 필지에 제공한 조문을 기준으로 한다) */
export const ALL_ARTICLES: Map<string, LawArticle> = new Map([...ARTICLES, ...RELATED_ARTICLES]);

/** 구역 이름 → 관계법령 제한 검토 정의 */
export const RELATED_DEFS = (relatedMapRaw as unknown as { 구역: RelatedZoneDef[] }).구역;

/** 관계법령 검토에 쓴 법령 이름과 조문 수 */
export const RELATED_LAWS = relatedDocs.map((d) => d as unknown as { 문서명: string; 조문수: number }).map((d) => ({ 문서명: d.문서명, 조문수: d.조문수 }));
