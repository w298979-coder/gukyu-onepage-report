// Design Ref: §4 — 필지·법령 데이터 형식. 앱과 데이터 생성 스크립트가 같은 형식을 쓰도록 한곳에 정의한다.
// Plan: 작업 1 (필지 데이터 항목과 형식 정하기)

/** 값의 출처. 화면에서 값 옆에 작게 표시한다. 가상 정보가 실제 사실로 오해되지 않게 하기 위함. */
export const SOURCES = ["브이월드", "포털", "가상", "수정"] as const;
export type Source = (typeof SOURCES)[number];

/** 포털에서 확인된 재산 상태 다섯 가지 (관리방향 판단의 기준). */
export const PORTAL_STATUSES = [
  "사용중인재산(대부/수의)",
  "사용중인재산(무단점유)",
  "대부(입찰)검토재산",
  "매각제한재산",
  "사용중인재산(대부/입찰)",
] as const;
export type PortalStatus = (typeof PORTAL_STATUSES)[number];

/** 재산 구분. 이번 사이클은 토지만 쓴다(공작물은 대상에서 제외). */
export type PropertyKind = "토지";

/** 항목 하나 = 값 + 출처 (+ 다른 출처의 값). 값이 없으면 value는 null이고 화면에는 "해당 없음"으로 표시한다. */
export interface Field<T> {
  value: T | null;
  source: Source;
  /** 다른 출처의 값. 예: 포털과 브이월드의 면적이 다르면 value는 포털의 국유재산 면적, alt는 브이월드의 필지 전체 면적이다. */
  alt?: { value: T | null; source: Source };
  /** 출처가 "수정"일 때만 채운다. */
  editedBy?: string;
  editedAt?: string;
}

/** 점유자 (가상 데이터). 실제 개인정보를 쓰지 않는다. */
export interface Occupant {
  id: string;
  이름: string;
  점유면적: number | null; // ㎡
  점유시작일: string | null;
  비고: string | null;
}

/** 대부계약 (가상 데이터). 점유자 id로 "점유자별 대부계약"을 잇는다. */
export interface Lease {
  id: string;
  점유자id: string;
  계약시작일: string | null;
  계약종료일: string | null;
  연사용료: number | null; // 원
  상태: "유효" | "만료" | "해지";
}

/** 변상금 부과 (가상 데이터). */
export interface Penalty {
  id: string;
  점유자id: string;
  부과일: string | null;
  금액: number | null; // 원
  납부상태: "미납" | "일부납부" | "완납";
}

/** 민원 (가상 데이터). */
export interface Complaint {
  id: string;
  접수일: string | null;
  내용: string;
  처리상태: "접수" | "처리중" | "완료";
}

/** 연도별 개별공시지가 (브이월드). 최신 값은 현재, 나머지는 과거이력으로 보여준다. */
export interface LandPrice {
  연도: number;
  단가: number; // 원/㎡
}

/** 과거 무단점유·대부계약 이력 (가상 데이터). */
export interface PastUse {
  종류: "무단점유" | "대부계약" | "변상금" | "민원";
  시작일: string | null;
  종료일: string | null;
  내용: string;
}

/** 필지 하나의 전체 데이터. data/parcels.json 에 29건이 들어간다. */
export interface Parcel {
  /** 브이월드 고유번호(PNU). 못 찾으면 포털 정보로 만든 임시 id. */
  id: string;
  /** 포털 소재지 전체 (예: 대전광역시 동구 가양동 174-59) */
  지번: string;
  구분: PropertyKind;
  상태: PortalStatus;

  /** 국유재산 면적(포털, ㎡)이 value, 브이월드 필지 전체 면적(㎡)이 alt. 포털 값이 없으면 브이월드 값을 value로 쓴다. */
  면적: Field<number>;
  지목: Field<string>;
  /** 실제지목(현황지목). 브이월드 토지특성정보의 이용상황. */
  실제지목: Field<string>;
  공시지가: Field<LandPrice[]>;
  용도지역: Field<string[]>;

  점유자: Occupant[];
  대부계약: Lease[];
  변상금: Penalty[];
  민원: Complaint[];
  기타관리사항: Field<string>;

  /** 과거 무단점유·대부계약 이력 */
  과거이용: PastUse[];
}

/** 담당자가 수정·추가할 수 있는 항목. 공개 자료(포털·브이월드) 값은 수정할 수 없다. */
export const EDITABLE_ITEMS = ["점유자", "대부계약", "변상금", "민원", "기타관리사항"] as const;
export type EditableItem = (typeof EDITABLE_ITEMS)[number];

/** 브라우저 저장소에 보관하는 수정 기록 하나. */
export interface EditRecord {
  parcelId: string;
  항목: EditableItem;
  /** 수정 후 값 (항목에 따라 목록 또는 글). JSON으로 저장 가능한 값만 쓴다. */
  새값: unknown;
  이전값: unknown;
  수정자: string;
  수정시각: string; // ISO 형식
}

/** 법령·내규 조문 하나. AI는 문서명 대신 id로 인용한다. */
export interface LawArticle {
  id: string;
  문서명: string;
  조문번호: string;
  /** 조문 제목. 삭제된 조문은 없을 수 있다. */
  제목?: string | null;
  내용: string;
  출처주소: string;
}

/** 대부·처분을 제한하는 조항. 적용 조건에 맞는 필지에만 코드가 골라 붙인다. */
export interface Restriction {
  /** 근거 조문 id (data/law/*.json 의 articles[].id) */
  조문id: string;
  /** 대부·처분 제한, 또는 관리 중 주의할 점("관리") */
  대상: "대부" | "처분" | "관리";
  적용조건: {
    상태?: PortalStatus[];
    지목?: string[];
  };
  제한내용: string;
}

/** 찾지 못한 문서. 화면과 CHECK.md에 "미확인"으로 밝힌다. */
export interface MissingDoc {
  문서명: string;
  사유: string;
}

/** 매각가능여부 판정 세 가지. */
export const VERDICTS = ["가능", "불가", "추가 확인 필요"] as const;
export type Verdict = (typeof VERDICTS)[number];
