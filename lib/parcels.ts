// Design Ref: §3.2, §5 — 필지 데이터(data/parcels.json)를 서버에서 읽는다.
// 이 파일은 서버 코드(page.tsx 등)에서만 불러온다. 브라우저 번들에 데이터 전체가 들어가지 않게 하기 위함이다.
import raw from "@/data/parcels.json";
import type { Parcel } from "./types";

const parcels = raw.parcels as unknown as Parcel[];

export function getParcels(): Parcel[] {
  return parcels;
}

export function getParcelById(id: string): Parcel | undefined {
  return parcels.find((p) => p.id === id);
}
