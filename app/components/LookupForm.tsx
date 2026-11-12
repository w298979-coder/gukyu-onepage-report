// Design Ref: §2 — 지번 입력 칸. 입력을 서버로 보내는 단순한 조회 양식(자바스크립트 없이도 동작).
import { MAX_INPUT_LENGTH } from "@/lib/jibun";

export default function LookupForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form action="/" method="get" className="flex w-full max-w-xl gap-2" role="search">
      <label htmlFor="q" className="sr-only">
        지번
      </label>
      <input
        id="q"
        name="q"
        type="text"
        defaultValue={defaultValue}
        maxLength={MAX_INPUT_LENGTH}
        autoComplete="off"
        autoFocus
        placeholder="지번 입력 (예: 가양동 174-59)"
        className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
      />
      <button
        type="submit"
        className="rounded-md bg-blue-700 px-6 py-3 text-base font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        조회
      </button>
    </form>
  );
}
