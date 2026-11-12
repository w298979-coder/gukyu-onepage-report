// 관계법령상 제한 검토(lib/related-core.ts) 시험. 실행: node --no-warnings scripts/test-related.mjs
import fs from "node:fs";
import { reviewRelated, relatedForPrompt } from "../lib/related-core.ts";
import { finalizeReview, selectRestrictions } from "../lib/review-core.ts";

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const relatedArticles = new Map(fs.readdirSync("data/law/related").flatMap((f) => read(`data/law/related/${f}`).articles).map((a) => [a.id, a]));
const lawArticles = new Map(["act", "decree", "rule", "farmland", "sechik", "yogang", "disposal"].flatMap((f) => read(`data/law/${f}.json`).articles).map((a) => [a.id, a]));
const all = new Map([...lawArticles, ...relatedArticles]);
const defs = read("data/law/related-map.json").구역;
const RESTR = read("data/law/restrictions.json").restrictions;
const parcels = read("data/parcels.json").parcels;

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "통과" : "실패"} | ${name}${detail ? " | " + detail : ""}`);
};

check("정의의 근거 조문이 모두 저장된 관계법령 조문에 있다", defs.every((d) => [...d.조문, ...(d.참고조문 ?? [])].every((id) => relatedArticles.has(id))));
check("'제한 있음'·'조건부' 정의에는 근거 조문이 있다", defs.filter((d) => d.판정 !== "제한 확인되지 않음").every((d) => d.조문.length > 0));
check("정규식이 모두 올바르다", defs.every((d) => d.일치.every((r) => { try { new RegExp(r); return true; } catch { return false; } })));

const results = parcels.map((p) => ({ p, r: reviewRelated(p.용도지역.value, defs, relatedArticles) }));
check("29건 모든 구역 이름이 관계법령과 이어진다(미검토 0건)", results.every((x) => x.r.unreviewed.length === 0), results.flatMap((x) => x.r.unreviewed).join(","));
check("구역 정보가 없으면 '확인 필요'", reviewRelated([], defs, relatedArticles).overall === "확인 필요" && reviewRelated(null, defs, relatedArticles).overall === "확인 필요");
check("모르는 구역이 있으면 미검토로 올리고 '확인 필요'", (() => { const r = reviewRelated(["가축사육제한구역", "처음 보는 구역"], defs, relatedArticles); return r.unreviewed.join() === "처음 보는 구역" && r.overall === "확인 필요"; })());

const withGaesup = results.filter((x) => (x.p.용도지역.value ?? []).includes("정비구역"));
check("정비구역 필지는 '제한 있음'(도시정비법 제98조)", withGaesup.length > 0 && withGaesup.every((x) => x.r.overall === "제한 있음" && x.r.items.some((i) => i.citations.some((c) => c.label === "도시 및 주거환경정비법 제98조"))), `${withGaesup.length}건`);
const park = results.filter((x) => (x.p.용도지역.value ?? []).includes("근린공원"));
check("근린공원 필지는 '제한 있음'(도시공원법 제52조)", park.length > 0 && park.every((x) => x.r.overall === "제한 있음" && x.r.items.some((i) => i.citations.some((c) => c.label.endsWith("제52조")))));
const road = results.filter((x) => (x.p.용도지역.value ?? []).some((z) => /^(대로|소로)/.test(z)));
check("도로(도시계획시설) 필지는 제한 있음 또는 조건부 확인 필요", road.length > 0 && road.every((x) => ["제한 있음", "조건부 확인 필요"].includes(x.r.overall)));
const plain = results.filter((x) => x.r.items.every((i) => i.판정 === "제한 확인되지 않음"));
check("모든 항목이 '확인되지 않음'이면 '확인된 제한 없음'", plain.every((x) => x.r.overall === "확인된 제한 없음"), `${plain.length}건`);
check("분포: 제한 있음/조건부/없음", true, ["제한 있음", "조건부 확인 필요", "확인된 제한 없음", "확인 필요"].map((k) => `${k} ${results.filter((x) => x.r.overall === k).length}`).join(", "));
check("'제한 있음'이 '조건부'보다 앞에 정렬된다", results.every((x) => x.r.items.every((i, k, a) => k === 0 || !(a[k - 1].판정 === "조건부 확인 필요" && i.판정 === "제한 있음"))));
check("인용 주소는 법제처 주소", results.every((x) => x.r.items.every((i) => i.citations.every((c) => c.url.startsWith("https://www.law.go.kr/")))));

// AI 질문과 판정 보정에 관계법령 결과가 반영된다
const g = withGaesup[0];
const pr = relatedForPrompt(g.r);
check("질문에 제한 있음·조건부 항목과 근거 id가 들어간다", pr.lines.length > 0 && pr.articleIds.includes("도시 및 주거환경정비법-제98조"));
const restr = selectRestrictions(g.p, RESTR);
const reasonId = restr[0].조문id;
const ai = { verdict: "가능", verdictReasons: [{ text: "근거", articleIds: [reasonId] }], management: [], cautions: [] };
let res = finalizeReview(ai, g.p, restr, all, { extraAllowedIds: pr.articleIds, relatedLimited: true });
check("관계법령상 제한이 있으면 AI의 '가능'을 '추가 확인 필요'로 바꾼다", res.verdict === "추가 확인 필요" && res.verdictNote.includes("관계법령상"));
res = finalizeReview(ai, g.p, restr, all, { extraAllowedIds: pr.articleIds, relatedLimited: false });
check("제한이 없으면 '가능'은 그대로", res.verdict === "가능");
res = finalizeReview({ ...ai, verdictReasons: [{ text: "관계법령 근거", articleIds: ["도시 및 주거환경정비법-제98조"] }] }, g.p, restr, all, { extraAllowedIds: pr.articleIds, relatedLimited: false });
check("AI가 관계법령 근거 조문을 인용할 수 있다", res.verdictReasons.length === 1 && res.verdictReasons[0].citations[0].label === "도시 및 주거환경정비법 제98조");
res = finalizeReview({ ...ai, verdictReasons: [{ text: "관계법령 근거", articleIds: ["도시 및 주거환경정비법-제98조"] }] }, g.p, restr, all, {});
check("제공하지 않은 관계법령 조문은 인용할 수 없다", res.verdictReasons.length === 0);

console.log(failed === 0 ? "\n모든 시험 통과" : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
