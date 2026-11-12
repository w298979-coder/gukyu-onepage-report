# 국유재산 원보드리포트

대전광역시 국유재산(토지 29건)의 종합현황, 매각가능여부 검토(관계법령상 제한 + 처분기준상 제한), 관리방안을 **화면 한 장·A4 한 장**으로 보여 주는 앱입니다. 지번 또는 점유자 이름으로 조회합니다. 점유자·대부계약·변상금·민원·사진 등은 실습용 **가상 데이터**입니다.

자세한 내용: [PRD.md](PRD.md)(무엇을·왜) · [PLAN.md](PLAN.md)(순서와 성공 기준) · [DESIGN.md](DESIGN.md)(어떻게) · [CHECK.md](CHECK.md)(점검 결과) · [CLAUDE.md](CLAUDE.md)(작업 규칙)

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

## 환경 변수 (`.env`, 깃에 올리지 않음)

| 이름 | 용도 |
|---|---|
| `OPENAI_API_KEY` | AI 검토(서버에서만 사용) |
| `OPENAI_MODEL` | (선택) 모델 이름, 기본 `gpt-4o-mini` |
| `VWORLD_KEY` | 브이월드 조회 스크립트(`scripts/fetch-vworld.mjs`, `fetch-aerial.mjs`) |
| `LAW_OC` | 법제처 관계법령 조문 받기 스크립트(`scripts/fetch-related-law.mjs`) |

배포(Vercel)에서는 `OPENAI_API_KEY`(와 필요하면 `OPENAI_MODEL`)를 프로젝트 환경 변수로 등록합니다. 앱 실행에는 `VWORLD_KEY`, `LAW_OC`가 필요 없습니다(데이터는 미리 받아 저장). 배포 전 Vercel Firewall 호출 제한과 OpenAI 월 예산 한도를 설정하세요.

## 시험과 점검

```bash
node --no-warnings scripts/test-report.mjs     # 리포트 글·정렬
node --no-warnings scripts/test-review.mjs     # AI 검증·판정 보정
node --no-warnings scripts/test-edits.mjs      # 수정 저장
node --no-warnings scripts/test-jibun.mjs      # 지번 정리
node --no-warnings scripts/test-related.mjs    # 관계법령상 제한
node --no-warnings scripts/test-occupant.mjs   # 점유자별 리포트
node scripts/print-check.mjs <출력 폴더> <주소...>   # 실제 크롬 PDF 인쇄 1쪽 점검 (개발 서버 필요)
```

## 데이터 만들기 (필요할 때만)

`scripts/`의 `fetch-vworld.mjs` → `build-parcel-data.mjs`(필지 데이터), `fetch-aerial.mjs`(항공사진 캡처), `fetch-related-law.mjs`(관계법령 조문), `extract-hwp*.mjs`·`merge-approval.mjs`(내규 별표 6). 순서와 설명은 DESIGN.md §3.1.
