# 평가항목 전체 카탈로그

모든 평가항목을 여기에 정의합니다. 대회/수업마다 관리자가 이 카탈로그에서 **필요한 항목만 선택**하고 **비중(가중치)을 설정**해서 그때그때 평가기준표를 구성합니다.

- 코드 상의 원본: `lib/criteria.ts` (앱은 이 파일을 사용합니다. 문서와 코드가 다르면 코드를 문서에 맞춰 수정할 것)
- 기본 척도: 각 항목 0~5점 (관리자가 척도 변경 가능), 최종 점수는 가중치 반영 100점 환산
- 적용 유형: R = 리텔링, A = 보고 읽기(낭독), Q = 질문 답변

## A. 전달 (Delivery) — 모든 유형 공통

| ID | 항목 | 설명 | 적용 |
|---|---|---|---|
| pronunciation | 발음 정확성 | 개별 음소·단어를 알아듣기 쉽게 발음하는가. 한국인 학습자가 자주 틀리는 음(r/l, p/f, th 등) 포함 | R A Q |
| intonation | 억양·강세 | 문장 억양, 단어 강세, 리듬이 자연스러운가 | R A Q |
| fluency | 유창성 | 머뭇거림·불필요한 멈춤 없이 말이 이어지는가. 필러(um, uh) 남용 여부 | R A Q |
| pacing | 발화 속도 | 너무 빠르거나 느리지 않게, 듣는 사람 기준의 속도를 유지하는가 | R A Q |
| volume_clarity | 성량·명료성 | 충분한 크기와 또렷함으로 전달하는가 | R A Q |
| confidence | 자신감·태도 | 위축되지 않고 안정적으로 발표하는가 (현장 심사위원용 항목) | R A Q |

## B. 언어 (Language) — 리텔링·질문답변

| ID | 항목 | 설명 | 적용 |
|---|---|---|---|
| grammar | 문법 정확성 | 시제, 수일치, 어순 등 문법 오류가 이해를 방해하지 않는가 | R Q |
| vocabulary | 어휘 사용 | 수준에 맞는 어휘를 정확하고 다양하게 쓰는가 | R Q |
| sentence_variety | 문장 다양성 | 단문 나열이 아니라 접속사·복문 등 다양한 문장 구조를 쓰는가 | R Q |

## C. 내용 (Content) — 리텔링 전용

| ID | 항목 | 설명 | 적용 |
|---|---|---|---|
| content_coverage | 핵심 내용 포함 | 원문의 핵심 사건·인물·주제를 빠뜨리지 않고 담았는가 | R |
| content_accuracy | 내용 정확성 | 원문 내용을 왜곡·오해 없이 전달했는가 | R |
| organization | 구성·논리 | 사건 순서, 인과관계가 논리적으로 이어지는가 | R Q |
| paraphrasing | 재구성(자기 언어) | 원문을 통째로 암송하지 않고 자기 말로 바꿔 표현했는가 | R |
| creativity | 창의적 표현 | 자기만의 표현·해석을 더했는가 (선택 항목) | R |

## D. 낭독 (Read-Aloud) — 보고 읽기 전용

| ID | 항목 | 설명 | 적용 |
|---|---|---|---|
| reading_accuracy | 낭독 정확성 | 생략·대체·추가 없이 지문 그대로 읽는가 | A |
| phrasing | 끊어 읽기 | 의미 단위·구두점에 맞게 끊어 읽는가 | A |
| expressiveness | 표현력 있는 낭독 | 내용과 감정에 맞는 어조 변화가 있는가 | A |

## E. 상호작용 (Interaction) — 질문 답변 전용

| ID | 항목 | 설명 | 적용 |
|---|---|---|---|
| question_comprehension | 질문 이해도 | 질문의 의도를 정확히 파악했는가 (되묻기 남용 여부 포함) | Q |
| relevance | 응답 적절성 | 질문에서 벗어나지 않은 답을 하는가 | Q |
| completeness | 응답 완성도 | 단답이 아니라 이유·예시로 답을 발전시키는가 | Q |
| spontaneity | 즉흥 대응력 | 준비되지 않은 질문에도 당황하지 않고 대응하는가 | Q |

## F. 운영 (Compliance) — 공통 선택 항목

| ID | 항목 | 설명 | 적용 |
|---|---|---|---|
| time_compliance | 시간 준수 | 제한 시간을 지켰는가 (초과/미달 감점 방식은 대회 설정에 따름) | R A Q |

## 사용 예시

- **리텔링 대회**: pronunciation 15% + fluency 15% + content_coverage 25% + content_accuracy 15% + organization 15% + paraphrasing 10% + time_compliance 5%
- **수업 낭독 연습**: reading_accuracy 40% + phrasing 25% + intonation 20% + pacing 15%
- **인터뷰(질문답변) 평가**: question_comprehension 20% + relevance 20% + completeness 25% + grammar 15% + fluency 20%

가중치 합은 항상 100%가 되도록 앱이 검증합니다.
