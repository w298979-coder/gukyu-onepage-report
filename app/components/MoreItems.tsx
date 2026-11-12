// Design Ref: §2 — 칸이 좁아 요약에 다 못 담은 항목이 있을 때 "추가사항 N건" 버튼으로 전체 목록을 보여 준다.
import type { ReactNode } from "react";
import DetailDialog from "./DetailDialog";

export default function MoreItems({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count <= 0) return null;
  return (
    <div className="mt-2 print:hidden">
      <DetailDialog title={title} label="전체 목록" buttonLabel={`추가사항 ${count}건 더 보기`} tone="has">
        {children}
      </DetailDialog>
    </div>
  );
}
