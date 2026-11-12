// Design Ref: §3.2, §6 — OpenAI 호출. 서버에서만 실행되며 OPENAI_API_KEY는 여기서만 읽는다.
import "server-only";
import { ARTICLES, RESTRICTIONS } from "./law";
import { getParcelById } from "./parcels";
import {
  AiReviewSchema,
  SYSTEM_PROMPT,
  buildUserPrompt,
  finalizeReview,
  sanitizeEdits,
  selectRestrictions,
  type ReviewResult,
} from "./review-core";

export const DEFAULT_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 1500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** 사용자에게 그대로 보여 줘도 되는 오류. 서버 설정 상태는 드러내지 않는다. */
export class ReviewError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** 환경 변수의 모델 이름은 모양이 맞을 때만 쓴다(엉뚱한 값이 요청에 섞이지 않게). */
function modelName(): string {
  const m = process.env.OPENAI_MODEL;
  return m && /^[A-Za-z0-9._-]{3,50}$/.test(m) ? m : DEFAULT_MODEL;
}

// 수정 내용이 없는 검토 결과는 필지별로 저장해 재사용한다(필지가 29건뿐이라 OpenAI 호출이 최대 29번으로 줄어든다).
// 진행 중인 같은 요청도 합쳐서 한 번만 부른다.
const cache = new Map<string, { at: number; promise: Promise<ReviewResult> }>();

export async function peekCachedReview(parcelId: string): Promise<ReviewResult | null> {
  const hit = cache.get(parcelId);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return null;
  try {
    return await hit.promise;
  } catch {
    return null;
  }
}

export async function runReview(parcelId: string, editsInput: unknown): Promise<ReviewResult> {
  const edits = sanitizeEdits(editsInput);
  if (Object.keys(edits).length > 0) return callOpenAI(parcelId, edits);

  const hit = cache.get(parcelId);
  if (hit && Date.now() - hit.at <= CACHE_TTL_MS) return hit.promise;
  const promise = callOpenAI(parcelId, edits);
  cache.set(parcelId, { at: Date.now(), promise });
  promise.catch(() => cache.delete(parcelId)); // 실패한 결과는 저장하지 않는다
  return promise;
}

async function callOpenAI(parcelId: string, edits: ReturnType<typeof sanitizeEdits>): Promise<ReviewResult> {
  const parcel = getParcelById(parcelId);
  if (!parcel) throw new ReviewError("해당 지번의 자료가 없습니다", 404);
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("[review] OPENAI_API_KEY가 설정되지 않음");
    throw new ReviewError("AI 검토를 지금 쓸 수 없습니다. 제한 조항은 그대로 확인할 수 있습니다.", 503);
  }

  const restrictions = selectRestrictions(parcel, RESTRICTIONS);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelName(),
        temperature: 0.2,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(parcel, edits, restrictions, ARTICLES) },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error("[review] OpenAI 연결 실패", timeout ? "시간 초과" : "");
    throw new ReviewError(timeout ? "AI 응답이 30초 안에 오지 않았습니다. 잠시 뒤 다시 시도해 주세요." : "AI 검토를 지금 쓸 수 없습니다.", 504);
  }
  if (!res.ok) {
    console.error("[review] OpenAI 오류 상태", res.status);
    throw new ReviewError("AI 검토를 지금 쓸 수 없습니다. 잠시 뒤 다시 시도해 주세요.", 502);
  }

  let parsed;
  try {
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    parsed = AiReviewSchema.safeParse(JSON.parse(body.choices?.[0]?.message?.content ?? ""));
  } catch {
    throw new ReviewError("AI 답을 읽지 못했습니다. 다시 시도해 주세요.", 502);
  }
  if (!parsed.success) throw new ReviewError("AI 답의 형식이 맞지 않아 표시하지 않았습니다. 다시 시도해 주세요.", 502);

  return finalizeReview(parsed.data, parcel, restrictions, ARTICLES);
}
