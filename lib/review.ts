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

/** 사용자에게 그대로 보여 줘도 되는 오류 */
export class ReviewError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function runReview(parcelId: string, editsInput: unknown): Promise<ReviewResult> {
  const parcel = getParcelById(parcelId);
  if (!parcel) throw new ReviewError("해당 지번의 자료가 없습니다", 404);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ReviewError("AI 검토를 쓸 수 없습니다: 서버에 OpenAI 키가 설정되지 않았습니다. 제한 조항은 아래에서 그대로 확인할 수 있습니다.", 503);

  const restrictions = selectRestrictions(parcel, RESTRICTIONS);
  const edits = sanitizeEdits(editsInput);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        temperature: 0.2,
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
    throw new ReviewError(timeout ? "AI 응답이 30초 안에 오지 않았습니다. 잠시 뒤 다시 시도해 주세요." : "AI 서버에 연결하지 못했습니다.", 504);
  }
  if (!res.ok) throw new ReviewError(`AI 서버가 오류를 돌려주었습니다(${res.status}).`, 502);

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
