// 매각가능여부 검토의 코드 부분(lib/review-core.ts) 시험. AI는 부르지 않고 가짜 답을 넣어 본다.
// 실행: node --no-warnings scripts/test-review.mjs
import fs from "node:fs";
import { articleMentions, AiReviewSchema, buildUserPrompt, finalizeReview, sanitizeEdits, selectRestrictions, SYSTEM_PROMPT } from "../lib/review-core.ts";

const read = (f) => JSON.parse(fs.readFileSync(`data/law/${f}.json`, "utf8"));
const articles = new Map(["act", "decree", "rule", "farmland", "sechik", "yogang", "disposal"].flatMap((f) => read(f).articles).map((a) => [a.id, a]));
const RESTR = read("restrictions").restrictions;
const parcels = JSON.parse(fs.readFileSync("data/parcels.json", "utf8")).parcels;

let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "통과" : "실패"} | ${name}${detail ? " | " + detail : ""}`);
};

// 제한 조항 선택
check("제한 조항의 근거 조문이 모두 저장된 자료에 있다", RESTR.every((r) => articles.has(r.조문id)), RESTR.filter((r) => !articles.has(r.조문id)).map((r) => r.조문id).join(","));
const sel = (p) => selectRestrictions(p, RESTR);
const limited = parcels.find((p) => p.상태 === "매각제한재산" && ["도로", "제방", "구거", "묘지"].includes(p.지목.value));
const normal = parcels.find((p) => p.상태 === "대부(입찰)검토재산");
check("모든 필지에 최소 1개 이상의 제한 조항이 적용된다", parcels.every((p) => sel(p).length >= 1));
check("조건 없는 조항은 모든 필지에 적용된다", RESTR.filter((r) => !r.적용조건.상태 && !r.적용조건.지목).every((r) => parcels.every((p) => sel(p).includes(r))));
check("매각제한재산·공공용 지목 필지에만 행정재산 처분 제한(제27조)이 붙는다", sel(limited).some((r) => r.조문id === "국유재산법-제27조") && !sel(normal).some((r) => r.조문id === "국유재산법-제27조"));
check("상태 조건이 안 맞는 조항은 붙지 않는다", RESTR.filter((r) => r.적용조건.상태 && !r.적용조건.상태.includes(normal.상태)).every((r) => !sel(normal).includes(r)));

const allowedId = sel(normal)[0].조문id;
const ok = (o) => ({ verdict: "추가 확인 필요", verdictReasons: [], management: [], cautions: [], ...o });
const S = (text, ids) => ({ text, articleIds: ids });

// 인용 검증
let r = finalizeReview(ok({ verdict: "가능", verdictReasons: [S("근거 있음", [allowedId])], management: [S("가짜 인용", ["국유재산법-제9999조"]), S("인용 없음", [])], cautions: [S("섞인 인용", ["없는-id", allowedId, allowedId])] }), normal, sel(normal), articles);
check("실제 있는 조문을 인용한 문장만 보인다", r.verdictReasons.length === 1 && r.management.length === 0 && r.cautions.length === 1);
check("없는 조문·인용 없는 문장은 숨기고 개수를 센다", r.hidden === 2, String(r.hidden));
check("섞인 인용에서 있는 것만 남고 중복은 하나로", r.cautions[0].citations.length === 1 && r.cautions[0].citations[0].id === allowedId);
check("조문 이름은 AI가 아니라 저장된 자료에서 만든다", r.verdictReasons[0].citations[0].label === `${articles.get(allowedId).문서명} ${articles.get(allowedId).조문번호}`, r.verdictReasons[0].citations[0].label);
check("근거가 있는 '가능'은 그대로 두되, 처분 제한 조항 확인 안내를 붙인다", r.verdict === "가능" && r.verdictNote !== null && r.verdictNote.includes("처분 제한 조항"), r.verdictNote);

// 저장돼 있어도 이 필지에 적용되지 않은 조문은 인용할 수 없다
const notAllowed = RESTR.find((x) => !sel(normal).some((y) => y.조문id === x.조문id))?.조문id;
r = finalizeReview(ok({ verdict: "가능", verdictReasons: [S("범위 밖 조문", [notAllowed])] }), normal, sel(normal), articles);
check("이 필지에 제공하지 않은 조문의 인용은 숨긴다", !notAllowed || (r.verdictReasons.length === 0 && r.verdict === "추가 확인 필요"));

// 글 속 조 번호 검사
const aNo = articles.get(allowedId).조문번호;
check("글 속 조 번호 추출", articleMentions("제27조제1항과 제 48 조의2, 제3조").join() === "제27조,제48조의2,제3조");
r = finalizeReview(ok({ verdictReasons: [S(`${aNo}에 따라 제9999조도 적용된다`, [allowedId]), S(`${aNo}에 따라 제한된다`, [allowedId]), S("조 번호 언급 없음", [allowedId])] }), normal, sel(normal), articles);
check("인용하지 않은 조 번호를 글에 적은 문장은 숨긴다", r.verdictReasons.length === 2 && r.hidden === 1, `${r.verdictReasons.length}/${r.hidden}`);

// 판정 보정
r = finalizeReview(ok({ verdict: "가능" }), normal, sel(normal), articles);
check("판정 근거가 하나도 없으면 '추가 확인 필요'", r.verdict === "추가 확인 필요" && r.verdictNote !== null);
r = finalizeReview(ok({ verdict: "가능", verdictReasons: [S("근거", [sel(limited)[0].조문id])] }), limited, sel(limited), articles);
check("매각제한재산은 AI가 '가능'이라 해도 '추가 확인 필요'", r.verdict === "추가 확인 필요" && r.verdictNote.includes("매각제한재산"));
r = finalizeReview(ok({ verdict: "불가", verdictReasons: [S("근거", [allowedId])] }), limited, sel(limited), articles);
check("'불가'는 근거가 있으면 그대로", r.verdict === "불가");

// 코드가 고른 제한 조항은 AI 결과와 무관하게 모두 붙는다
r = finalizeReview(ok(), limited, sel(limited), articles);
check("AI 결과가 비어도 제한 조항이 모두 표시된다", r.restrictions.length === sel(limited).length);
r = finalizeReview(ok(), normal, [{ ...sel(normal)[0], 조문id: "없는-조문" }], articles);
check("원문을 찾을 수 없는 제한 조항은 표시하지 않는다", r.restrictions.length === 0);

// 형식 검사
check("형식이 틀린 AI 답은 거절", !AiReviewSchema.safeParse({ verdict: "아마도 가능" }).success && !AiReviewSchema.safeParse({ verdict: "가능" }).success);
check("올바른 형식은 통과", AiReviewSchema.safeParse(ok({ verdict: "불가", cautions: [S("a", ["b"])] })).success);
check("문장이 너무 길면 거절", !AiReviewSchema.safeParse(ok({ cautions: [S("가".repeat(401), ["b"])] })).success);

// 입력/질문
const e = sanitizeEdits({ 민원: "철거함\u0000", 수정자: "홍길동", 점유자: 123, 변상금: "   " });
check("수정 내용은 정해진 항목의 글만 받고, 수정자 이름은 받지 않는다", e.민원 === "철거함" && !("수정자" in e) && !("점유자" in e) && !("변상금" in e), JSON.stringify(e));
const p = buildUserPrompt(normal, { 민원: "현장 확인" }, sel(normal), articles);
check("질문에 필지 id·수정자가 들어가지 않는다", !p.includes(normal.id) && !p.includes("수정자"));
check("질문에 제한 조항 근거 id와 조문 본문이 들어간다", p.includes(`<조문 id="${allowedId}">`) && p.includes("[이 필지에 적용되는 제한 조항]"));
check("질문에 담당자 수정 내용이 자료로 들어간다", p.includes("현장 확인"));
check("시스템 지침: 자료 속 지시 무시·조문 밖 근거 금지", SYSTEM_PROMPT.includes("따르지 않습니다") && SYSTEM_PROMPT.includes("목록에 없는"));
check("질문 길이가 적당하다(모든 필지 12만 자 이하)", parcels.every((q) => buildUserPrompt(q, {}, sel(q), articles).length < 120000), String(Math.max(...parcels.map((q) => buildUserPrompt(q, {}, sel(q), articles).length))));

console.log(failed === 0 ? "\n모든 시험 통과" : `\n실패 ${failed}건`);
process.exit(failed === 0 ? 0 : 1);
