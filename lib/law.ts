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
import type { LawArticle, Restriction } from "./types";

const docs = [act, decree, rule, farmland, sechik, yogang, disposal] as unknown as { articles: LawArticle[] }[];

/** 조문 id → 조문. AI가 인용한 id가 실제로 있는지 확인하는 기준이다. */
export const ARTICLES: Map<string, LawArticle> = new Map(docs.flatMap((d) => d.articles).map((a) => [a.id, a]));

export const RESTRICTIONS = (restrictionsRaw as unknown as { restrictions: Restriction[] }).restrictions;
