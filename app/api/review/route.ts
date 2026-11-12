// Design Ref: §3.2 — 매각가능여부 검토 API. 로그인 없는 공개 주소이므로 입력을 좁게 받고 호출 횟수를 제한한다.
import { NextResponse } from "next/server";
import { z } from "zod";
import { ReviewError, runReview } from "@/lib/review";

const Body = z.object({
  parcelId: z.string().regex(/^[0-9A-Za-z-]{1,40}$/),
  edits: z.record(z.string().max(20), z.string().max(500)).optional(),
});

// 접속 주소별로 1분에 5번까지(서버 한 대 기준의 간단한 제한)
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= 60_000)) hits.delete(k);
  return recent.length > 5;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "요청이 너무 잦습니다. 1분 뒤 다시 시도해 주세요." }, { status: 429 });
  if (Number(req.headers.get("content-length") ?? 0) > 8_000) return NextResponse.json({ error: "요청이 너무 큽니다." }, { status: 413 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 맞지 않습니다." }, { status: 400 });
  }
  const body = Body.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "요청 형식이 맞지 않습니다." }, { status: 400 });

  try {
    const result = await runReview(body.data.parcelId, body.data.edits);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ReviewError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "검토 중 오류가 발생했습니다." }, { status: 500 });
  }
}
