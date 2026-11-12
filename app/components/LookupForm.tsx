// Design Ref: §2 — 조회 입력 칸. 지번 또는 점유자 이름으로 조회하는 단순한 양식(자바스크립트 없이도 동작).
import { MAX_INPUT_LENGTH } from "@/lib/jibun";

export default function LookupForm({ defaultValue, defaultBy = "lot" }: { defaultValue: string; defaultBy?: "lot" | "occupant" }) {
  return (
    <form action="/" method="get" className="flex w-full max-w-2xl gap-2" role="search">
      <label htmlFor="by" className="sr-only">
        조회 기준
      </label>
      <select
        id="by"
        name="by"
        defaultValue={defaultBy}
        className="rounded-md border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
      >
        <option value="lot">지번</option>
        <option value="occupant">점유자</option>
      </select>
      <label htmlFor="q" className="sr-only">
        조회할 지번 또는 점유자 이름
      </label>
      <input
        id="q"
        name="q"
        type="text"
        defaultValue={defaultValue}
        maxLength={MAX_INPUT_LENGTH}
        autoComplete="off"
        autoFocus
        placeholder="지번(예: 가양동 174-59) 또는 점유자 이름(예: 이서준)"
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
