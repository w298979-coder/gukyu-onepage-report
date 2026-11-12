// Design Ref: §3.2, §6 — 매각가능여부 검토 API. 로그인 없는 공개 주소이므로 출처·형식·크기를 좁게 받고 호출 횟수를 제한한다.
// 비용 보호: 수정 내용이 없는 요청은 필지별로 결과를 저장해 두고(같은 필지는 OpenAI를 다시 부르지 않음) 호출 제한보다 먼저 확인한다.
import { NextResponse } from "next/server";
import { z } from "zod";
import { ReviewError, peekCachedReview, runReview } from "@/lib/review";

const MAX_BODY = 8_000; // 바이트

const Body = z
  .object({
    parcelId: z.string().regex(/^[0-9A-Za-z-]{1,40}$/),
    edits: z
      .object({
        점유자: z.string().max(500).optional(),
        대부계약: z.string().max(500).optional(),
        변상금: z.string().max(500).optional(),
        민원: z.string().max(500).optional(),
        기타관리사항: z.string().max(500).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// 접속 주소별로 1분에 5번까지(서버 한 대 기준의 간단한 제한. 배포 환경에서는 Vercel Firewall 등 바깥 제한을 함께 써야 한다)
const hits = new Map<string, number[]>();
const MAX_TRACKED = 2000;
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= 60_000)) hits.delete(k);
    while (hits.size > MAX_TRACKED) hits.delete(hits.keys().next().value as string); // 상한을 넘으면 오래된 것부터 지운다
  }
  return recent.length > 5;
}

const err = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(req: Request) {
  // 다른 사이트에서 보낸 요청과 JSON이 아닌 요청은 거절한다(사전 확인 없는 위조 요청 방지)
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) return err("요청 형식이 맞지 않습니다.", 415);
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return err("허용되지 않은 요청입니다.", 403);
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return err("허용되지 않은 요청입니다.", 403);

  // 본문 크기는 헤더가 아니라 실제로 읽은 글자 수로 검사한다
  let text: string;
  try {
    text = await req.text();
  } catch {
    return err("요청 형식이 맞지 않습니다.", 400);
  }
  if (new TextEncoder().encode(text).length > MAX_BODY) return err("요청이 너무 큽니다.", 413);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return err("요청 형식이 맞지 않습니다.", 400);
  }
  const body = Body.safeParse(json);
  if (!body.success) return err("요청 형식이 맞지 않습니다.", 400);
  const { parcelId, edits } = body.data;

  // 이미 만들어 둔 결과(수정 내용이 없는 요청)는 OpenAI를 부르지 않으므로 호출 제한을 적용하지 않는다
  const hasEdits = !!edits && Object.values(edits).some((v) => v && v.trim());
  if (!hasEdits) {
    const cached = await peekCachedReview(parcelId);
    if (cached) return NextResponse.json(cached);
  }

  const ip = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limited(ip)) {
    console.warn("[review] 호출 제한 초과");
    return err("요청이 너무 잦습니다. 1분 뒤 다시 시도해 주세요.", 429);
  }

  try {
    const result = await runReview(parcelId, edits);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ReviewError) return err(e.message, e.status);
    console.error("[review] 알 수 없는 오류");
    return err("검토 중 오류가 발생했습니다.", 500);
  }
}
