# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 컨텍스트입니다.

## 프로젝트 개요

`@us-all/mlflow-mcp` — MLflow REST API를 MCP stdio 서버로 노출하는 TypeScript 구현. 66개 도구 + 4개 워크플로우 프롬프트로 experiments / runs / registered-models / model-versions / logged-models(v3) / traces / assessments 전 영역 커버. 쓰기는 `MLFLOW_ALLOW_WRITE=true`로 명시 옵트인.

- **타겟 MLflow**: 3.5.1+ (v3 traces/assessments REST 사용)
- **런타임**: Node 20+, stdio transport (vitest 4 의존성)
- **인증**: Bearer 토큰(Databricks PAT) / Basic auth
- **빌드**: `pnpm build` → `dist/index.js`

## 디렉토리

```
src/
├── index.ts          # MCP 도구 66개 + 프롬프트 4개 등록
├── config.ts         # 환경변수 로딩
├── client.ts         # MlflowClient (fetch 래퍼, /api/ 절대경로 지원, DELETE w/ body)
├── prompts.ts        # MCP 워크플로우 프롬프트 4개
└── tools/
    ├── utils.ts                # wrapToolHandler, assertWriteAllowed, sanitize, applyExtractFields
    ├── experiments.ts          (9)
    ├── runs.ts                 (17, get-best-run/compare-runs/search-runs-by-tags 포함)
    ├── registered-models.ts    (12)
    ├── model-versions.ts       (9)
    ├── logged-models.ts        (8, MLflow 3 LoggedModel)
    ├── traces.ts               (6, v3 REST + extractFields)
    └── assessments.ts          (5, v3 REST)
dev/
├── seed.py           # demo 실험/런/모델/트레이스 시딩 (idempotent)
└── smoke.mjs         # 66 도구 + 4 프롬프트 전수 호출 자동 테스트
docker-compose.yml    # mlflow v3.11.1 + seed + mcp 프로필
```

## 로컬 검증

```bash
docker compose up -d mlflow
docker compose run --rm seed   # 실험/런/모델/트레이스까지 모두 시드됨
pnpm build && node dev/smoke.mjs   # 76/76 통과 기대
```

## 설계 원칙

- **Read-only by default**: 쓰기 도구는 `assertWriteAllowed()`로 게이트
- **REST 직통**: MLflow Python SDK 의존 없음
- **민감정보 마스킹**: 에러 메시지에서 token/password 패턴 `[REDACTED]`
- **camelCase ↔ snake_case**: 도구 핸들러에서 수동 변환

## 최근 변경사항 (2026-05-01)

- **v1.6.0**: `@us-all/mcp-toolkit ^0.1.0`으로 마이그레이션 — `tool-registry.ts`와 `applyExtractFields`를 toolkit에서 import. utils.ts의 inline 구현 제거. 단위 테스트(tool-registry, extract-fields)는 toolkit이 owns. ~170 lines 코드 절감.
- **v1.5.1**: `pnpm token-stats` 스크립트 + CI TOKEN_BUDGET=12000 가드 추가.
- **v1.5.0**: `summarize-run` 어그리게이션 도구 — run info + (opt) metric history per key + (opt) artifacts. 3-5 round-trips → 1 call.
- **v1.4.0**: MCP Resources (`mlflow://` URI scheme) 6개 — run, experiment, experiment-by-name, registered-model, model-version, trace.
- **v1.3.1**: `extractFields` auto-apply via `wrapToolHandler`. experiments / runs 핵심 read 스키마에 명시적 선언.
- **v1.3.0**: 카테고리 ENV 토글(`MLFLOW_TOOLS` / `MLFLOW_DISABLE`) 8 카테고리 + `search-tools` 메타툴.
- **v1.2.0**: Webhooks 6개 + Prompt Optimization 5개 도구 추가 (도구 66→77).

### 이전 변경사항 (2026-04-27)

- v1.1.1 패치: docker 멀티 아키텍처 (linux/amd64 + linux/arm64), vitest 단위 테스트 20개 추가, 문서 3종 (CHANGELOG/SECURITY/CONTRIBUTING)
- v1.1.0 마이너: 도구 55→66, 프롬프트 신규 4개. **76/76 통과** (스모크 검증)
- `extract_fields` 파라미터 도입 (`search-traces`, `get-trace`) — 콤마 구분 dotted path + `*` 와일드카드, `applyExtractFields` (utils.ts) 트리 기반 프로젝션
- 편의 도구 3개 추가 (`runs.ts`):
  - `get-best-run` — metric 기준 최고/최저 run
  - `compare-runs` — 다중 run 메트릭/파라미터 side-by-side + `differing_params` 자동 도출
  - `search-runs-by-tags` — tag key/value 매핑 → filter 표현식 컴파일
- `logged-models.ts` 신설 — MLflow 3 LoggedModel 8개 도구 (`/api/2.0/mlflow/logged-models[/...]`)
- `prompts.ts` 신설 — MCP 워크플로우 프롬프트 4개:
  - `debug-failed-traces`, `promote-best-run`, `compare-top-runs`, `annotate-trace-quality`
- `seed.py`에 trace 시드 통합 (`@mlflow.trace` 함수 2회 호출)

### 이전 변경사항

- 전 도구 스모크 테스트 (`dev/smoke.mjs`) 추가, **55/55 통과** 검증
- **MLflow v2.20.0 → v3.11.1** 업그레이드, `--allowed-hosts "*"` + `--cors-allowed-origins "*"` 추가
- `client.ts`: DELETE 메서드 body 방식, `/api/` 절대경로 지원, 배열 query `append()` 지원
- `traces.ts` 전면 재작성: v3 REST 경로 (`/api/3.0/mlflow/traces/...`)
- `assessments.ts` 전면 재작성: v3 REST + `update-assessment`의 `update_mask` 자동 생성

## 알려진 이슈

- ~~트레이스 시드 미포함~~ → 해결 (seed.py 통합)
- ~~응답 필드 선택 없음~~ → 해결 (extractFields 파라미터)
- ~~MLflow v3 LoggedModel 엔티티 미지원~~ → 해결 (logged-models.ts)
- ~~편의 도구 부재~~ → 해결 (get-best-run, compare-runs, search-runs-by-tags)
- ~~MCP Prompts/Resources 미사용~~ → 해결 (Prompts 4개 + Resources 6개 v1.4.0)
- ~~CI 자동화 부재~~ → 해결 (token-stats CI 가드 v1.5.1)
- **인증 경로 미검증**: Bearer 토큰/Basic auth 코드는 있으나 실제 백엔드 검증은 안 됨

## 개선 로드맵

- [x] `seed.py`에 트레이스/feedback 시드 추가
- [x] `extract_fields` 파라미터 도입
- [x] `logged-models/*` 도구 신설
- [x] 편의 도구: `compare-runs`, `get-best-run`, `search-runs-by-tags`
- [x] MCP Prompts로 흔한 워크플로우 템플릿 제공
- [x] CI: smoke.mjs를 GitHub Actions에서 docker compose 띄워 자동 실행
- [ ] 인증 테스트: Databricks PAT/Basic auth 경로 검증
- [x] MCP Resources: 자주 보는 객체(experiment, run, registered-model)를 리소스 URI로 노출 (v1.4.0)
- [x] `extract_fields`를 search-runs / get-run에도 적용 (v1.3.1)
- [x] `summarize-run` 어그리게이션 도구 (v1.5.0)
- [x] `@us-all/mcp-toolkit` 마이그레이션 (v1.6.0)
- [x] vitest 단위 테스트 (config, extract-fields, sanitize)
- [x] CHANGELOG / SECURITY / CONTRIBUTING 문서
- [x] docker 멀티 아키텍처

## 다른 MLflow MCP와의 위치

| 구현 | 도구 수 | 커버리지 | 비고 |
|---|---|---|---|
| **us-all/mlflow-mcp (this)** | 55 | 전 영역 | TS, REST 직통 |
| 공식 `mlflow[mcp]` | 10 | traces only | `extract_fields` 지원 |
| kkruglik/mlflow-mcp | ~40 | exp/runs/registry + LoggedModel | 편의 도구 + MCP Prompts |
| yesid-lopez/mlflow-mcp-server | ~12 | 최소 | uvx 배포 |
| iRahulPandey/mlflowMCPServer | 적음 | 읽기 전용 | LangChain 클라이언트 번들 |

전 영역 커버리지가 가장 넓다는 점이 차별점. 약점은 응답 토큰 효율과 편의 도구 부재.
