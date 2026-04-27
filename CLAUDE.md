# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 컨텍스트입니다.

## 프로젝트 개요

`@us-all/mlflow-mcp` — MLflow REST API를 MCP stdio 서버로 노출하는 TypeScript 구현. 55개 도구로 experiments / runs / registered-models / model-versions / traces / assessments를 모두 커버하며, 쓰기는 `MLFLOW_ALLOW_WRITE=true`로 명시 옵트인.

- **타겟 MLflow**: 3.5.1+ (v3 traces/assessments REST 사용)
- **런타임**: Node 18+, stdio transport
- **인증**: Bearer 토큰(Databricks PAT) / Basic auth
- **빌드**: `pnpm build` → `dist/index.js`

## 디렉토리

```
src/
├── index.ts          # MCP 도구 55개 등록
├── config.ts         # 환경변수 로딩
├── client.ts         # MlflowClient (fetch 래퍼, /api/ 절대경로 지원, DELETE w/ body)
└── tools/
    ├── utils.ts      # wrapToolHandler, assertWriteAllowed, sanitize
    ├── experiments.ts        (9)
    ├── runs.ts               (14)
    ├── registered-models.ts  (12)
    ├── model-versions.ts     (9)
    ├── traces.ts             (6, v3 REST)
    └── assessments.ts        (5, v3 REST)
dev/
├── seed.py           # demo 실험/런/모델 시딩 (idempotent)
└── smoke.mjs         # 55개 도구 전수 호출 자동 테스트
docker-compose.yml    # mlflow v3.11.1 + seed + mcp 프로필
```

## 로컬 검증

```bash
docker compose up -d mlflow
docker compose run --rm seed
# 트레이스 시드는 별도:
docker exec mlflow-mcp-server-mlflow-1 python -c "import mlflow; mlflow.set_tracking_uri('http://localhost:5000'); mlflow.set_experiment('demo'); 
import mlflow; 
@mlflow.trace
def f(q): return q
f('ping'); f('pong')"

pnpm build && node dev/smoke.mjs   # 55/55 통과 기대
```

## 설계 원칙

- **Read-only by default**: 쓰기 도구는 `assertWriteAllowed()`로 게이트
- **REST 직통**: MLflow Python SDK 의존 없음
- **민감정보 마스킹**: 에러 메시지에서 token/password 패턴 `[REDACTED]`
- **camelCase ↔ snake_case**: 도구 핸들러에서 수동 변환

## 최근 변경사항 (2026-04-27)

- 전 도구 스모크 테스트 (`dev/smoke.mjs`) 추가, **55/55 통과** 검증
- **MLflow v2.20.0 → v3.11.1**로 docker-compose 업그레이드
  - v3 DNS rebinding 보호 회피: `--allowed-hosts "*"`, `--cors-allowed-origins "*"`
- `client.ts`:
  - DELETE 메서드를 query string → JSON body로 변경 (MLflow 3은 body 요구)
  - `/api/`로 시작하는 path는 baseUrl(`/api/2.0/mlflow`) 우회 허용 → v3 엔드포인트 호출 가능
  - 배열 query 파라미터 `append()`로 다중 값 지원
- `traces.ts` 전면 재작성:
  - `search-traces` → `POST /api/3.0/mlflow/traces/search` (`locations` 객체 스키마)
  - `get-trace` → `GET /api/3.0/mlflow/traces/{trace_id}`
  - `get-trace-info` → `GET /api/2.0/mlflow/traces/{trace_id}/info`
  - `delete-traces` → `POST /api/2.0/mlflow/traces/delete-traces`
  - `set-trace-tag` → `PATCH /traces/{trace_id}/tags`
  - `delete-trace-tag` → `DELETE /traces/{trace_id}/tags` (body)
- `assessments.ts` 전면 재작성: 모두 `/api/3.0/mlflow/traces/{trace_id}/assessments[/{aid}]` REST 경로
  - `update-assessment`은 변경 필드로 `update_mask` FieldMask 자동 생성

## 알려진 이슈

- **트레이스 시드 미포함**: `dev/seed.py`는 experiments/runs/models만 시딩, 트레이스는 별도로 생성해야 smoke가 trace/assessment 도구를 검증
- **응답 필드 선택 없음**: 공식 MLflow MCP가 제공하는 `extract_fields` 미지원 → 큰 trace 호출 시 토큰 비대화
- **MLflow v3 LoggedModel 엔티티 미지원**: registry 도구는 있지만 v3의 `logged_models/*` API 도구 부재
- **편의 도구 부재**: `compare-runs`, `get-best-run` 같은 합성 헬퍼 없음 (raw 1:1 매핑만)
- **MCP Prompts/Resources 미사용**: 도구만 노출, 프롬프트 템플릿/리소스 미제공

## 개선 로드맵

- [ ] `seed.py`에 트레이스/feedback 시드 추가
- [ ] `extract_fields` 파라미터 도입 (search-traces / get-trace 응답 슬라이싱)
- [ ] `logged-models/*` 도구 신설 (MLflow 3 LoggedModel)
- [ ] 편의 도구: `compare-runs`, `get-best-run`, `search-runs-by-tags`
- [ ] MCP Prompts로 흔한 워크플로우 템플릿 제공
- [ ] CI: smoke.mjs를 GitHub Actions에서 docker compose 띄워 자동 실행
- [ ] 인증 테스트: Databricks PAT/Basic auth 경로 검증

## 다른 MLflow MCP와의 위치

| 구현 | 도구 수 | 커버리지 | 비고 |
|---|---|---|---|
| **us-all/mlflow-mcp (this)** | 55 | 전 영역 | TS, REST 직통 |
| 공식 `mlflow[mcp]` | 10 | traces only | `extract_fields` 지원 |
| kkruglik/mlflow-mcp | ~40 | exp/runs/registry + LoggedModel | 편의 도구 + MCP Prompts |
| yesid-lopez/mlflow-mcp-server | ~12 | 최소 | uvx 배포 |
| iRahulPandey/mlflowMCPServer | 적음 | 읽기 전용 | LangChain 클라이언트 번들 |

전 영역 커버리지가 가장 넓다는 점이 차별점. 약점은 응답 토큰 효율과 편의 도구 부재.
