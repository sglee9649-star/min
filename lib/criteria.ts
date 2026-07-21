// 평가항목 전체 카탈로그 — 문서: docs/EVALUATION_CRITERIA.md
// 대회/수업마다 이 카탈로그에서 항목을 선택하고 가중치를 설정해 루브릭을 구성한다.

export type TaskType = "retelling" | "readAloud" | "qna";

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  retelling: "리텔링",
  readAloud: "보고 읽기",
  qna: "질문 답변",
};

export const TASK_TYPE_LABELS_EN: Record<TaskType, string> = {
  retelling: "Retelling",
  readAloud: "Read-Aloud",
  qna: "Q&A",
};

// 한/영 병기 표시용: "리텔링 (Retelling)"
export function taskTypeLabel(task: TaskType): string {
  return `${TASK_TYPE_LABELS[task]} (${TASK_TYPE_LABELS_EN[task]})`;
}

export interface Criterion {
  id: string;
  name: string;
  nameEn: string;
  group: "delivery" | "language" | "content" | "readAloud" | "interaction" | "compliance";
  description: string;
  appliesTo: TaskType[];
  optional?: boolean; // 기본 추천 세트에 넣지 않는 선택 항목
  // AI가 전사본(글)만으로 채점 가능한 항목인지.
  // 발음·억양·성량처럼 소리를 들어야 아는 항목은 false — 심사위원이 채점한다.
  aiEvaluable: boolean;
  descriptionEn: string; // 외국인 심사위원용 영어 설명
}

export const CRITERIA_CATALOG: Criterion[] = [
  // A. 전달 (Delivery)
  { id: "pronunciation", name: "발음 정확성", nameEn: "Pronunciation", group: "delivery", description: "개별 음소·단어를 알아듣기 쉽게 발음하는가 (r/l, p/f, th 등 포함)", appliesTo: ["retelling", "readAloud", "qna"] , aiEvaluable: false , descriptionEn: "Are individual sounds and words pronounced clearly? (incl. r/l, p/f, th)" },
  { id: "intonation", name: "억양·강세", nameEn: "Intonation & Stress", group: "delivery", description: "문장 억양, 단어 강세, 리듬이 자연스러운가", appliesTo: ["retelling", "readAloud", "qna"] , aiEvaluable: false , descriptionEn: "Natural sentence intonation, word stress, and rhythm" },
  { id: "fluency", name: "유창성", nameEn: "Fluency", group: "delivery", description: "머뭇거림·불필요한 멈춤 없이 말이 이어지는가", appliesTo: ["retelling", "readAloud", "qna"] , aiEvaluable: false , descriptionEn: "Speech flows without hesitation or unnecessary pauses" },
  { id: "pacing", name: "발화 속도", nameEn: "Pacing", group: "delivery", description: "듣는 사람 기준으로 적절한 속도를 유지하는가", appliesTo: ["retelling", "readAloud", "qna"] , aiEvaluable: false , descriptionEn: "Maintains a listener-friendly speaking speed" },
  { id: "volume_clarity", name: "성량·명료성", nameEn: "Volume & Clarity", group: "delivery", description: "충분한 크기와 또렷함으로 전달하는가", appliesTo: ["retelling", "readAloud", "qna"] , aiEvaluable: false , descriptionEn: "Speaks loudly and clearly enough to be understood" },
  { id: "confidence", name: "자신감·태도", nameEn: "Confidence", group: "delivery", description: "위축되지 않고 안정적으로 발표하는가 (현장 심사위원용)", appliesTo: ["retelling", "readAloud", "qna"], optional: true , aiEvaluable: false , descriptionEn: "Presents calmly and confidently without shrinking back" },

  // B. 언어 (Language)
  { id: "grammar", name: "문법 정확성", nameEn: "Grammar", group: "language", description: "시제, 수일치, 어순 등 문법 오류가 이해를 방해하지 않는가", appliesTo: ["retelling", "qna"] , aiEvaluable: true , descriptionEn: "Grammar errors (tense, agreement, word order) do not impede understanding" },
  { id: "vocabulary", name: "어휘 사용", nameEn: "Vocabulary", group: "language", description: "수준에 맞는 어휘를 정확하고 다양하게 쓰는가", appliesTo: ["retelling", "qna"] , aiEvaluable: true , descriptionEn: "Uses level-appropriate vocabulary accurately and variedly" },
  { id: "sentence_variety", name: "문장 다양성", nameEn: "Sentence Variety", group: "language", description: "다양한 문장 구조(접속사·복문 등)를 쓰는가", appliesTo: ["retelling", "qna"], optional: true , aiEvaluable: true , descriptionEn: "Uses varied sentence structures (connectors, complex sentences)" },

  // C. 내용 (Content) — 리텔링
  { id: "content_coverage", name: "핵심 내용 포함", nameEn: "Content Coverage", group: "content", description: "원문의 핵심 사건·인물·주제를 빠뜨리지 않았는가", appliesTo: ["retelling"] , aiEvaluable: true , descriptionEn: "Includes the key events, characters, and theme of the original" },
  { id: "content_accuracy", name: "내용 정확성", nameEn: "Content Accuracy", group: "content", description: "원문 내용을 왜곡·오해 없이 전달했는가", appliesTo: ["retelling"] , aiEvaluable: true , descriptionEn: "Conveys the original content without distortion" },
  { id: "organization", name: "구성·논리", nameEn: "Organization", group: "content", description: "사건 순서, 인과관계가 논리적으로 이어지는가", appliesTo: ["retelling", "qna"] , aiEvaluable: true , descriptionEn: "Events and cause-effect flow in a logical order" },
  { id: "paraphrasing", name: "재구성(자기 언어)", nameEn: "Paraphrasing", group: "content", description: "원문을 통째로 암송하지 않고 자기 말로 바꿔 표현했는가", appliesTo: ["retelling"] , aiEvaluable: true , descriptionEn: "Retells in their own words rather than reciting the original verbatim" },
  { id: "creativity", name: "창의적 표현", nameEn: "Creativity", group: "content", description: "자기만의 표현·해석을 더했는가", appliesTo: ["retelling"], optional: true , aiEvaluable: true , descriptionEn: "Adds their own expressions or interpretation" },

  // D. 낭독 (Read-Aloud)
  { id: "reading_accuracy", name: "낭독 정확성", nameEn: "Reading Accuracy", group: "readAloud", description: "생략·대체·추가 없이 지문 그대로 읽는가", appliesTo: ["readAloud"] , aiEvaluable: true , descriptionEn: "Reads the passage as written, without omissions, substitutions, or additions" },
  { id: "phrasing", name: "끊어 읽기", nameEn: "Phrasing", group: "readAloud", description: "의미 단위·구두점에 맞게 끊어 읽는가", appliesTo: ["readAloud"] , aiEvaluable: false , descriptionEn: "Pauses at meaningful units and punctuation" },
  { id: "expressiveness", name: "표현력 있는 낭독", nameEn: "Expressiveness", group: "readAloud", description: "내용과 감정에 맞는 어조 변화가 있는가", appliesTo: ["readAloud"] , aiEvaluable: false , descriptionEn: "Varies tone to match content and emotion" },

  // E. 상호작용 (Interaction) — 질문 답변
  { id: "question_comprehension", name: "질문 이해도", nameEn: "Question Comprehension", group: "interaction", description: "질문의 의도를 정확히 파악했는가", appliesTo: ["qna"] , aiEvaluable: true , descriptionEn: "Accurately grasps the intent of each question" },
  { id: "relevance", name: "응답 적절성", nameEn: "Relevance", group: "interaction", description: "질문에서 벗어나지 않은 답을 하는가", appliesTo: ["qna"] , aiEvaluable: true , descriptionEn: "Answers stay on topic without drifting from the question" },
  { id: "completeness", name: "응답 완성도", nameEn: "Completeness", group: "interaction", description: "단답이 아니라 이유·예시로 답을 발전시키는가", appliesTo: ["qna"] , aiEvaluable: true , descriptionEn: "Develops answers with reasons and examples, not one-word replies" },
  { id: "spontaneity", name: "즉흥 대응력", nameEn: "Spontaneity", group: "interaction", description: "준비되지 않은 질문에도 당황하지 않고 대응하는가", appliesTo: ["qna"], optional: true , aiEvaluable: false , descriptionEn: "Handles unexpected questions without losing composure" },

  // F. 운영 (Compliance)
  { id: "time_compliance", name: "시간 준수", nameEn: "Time Compliance", group: "compliance", description: "제한 시간을 지켰는가", appliesTo: ["retelling", "readAloud", "qna"], optional: true , aiEvaluable: false , descriptionEn: "Stays within the time limit" },
];

export const GROUP_LABELS: Record<Criterion["group"], string> = {
  delivery: "전달 (Delivery)",
  language: "언어 (Language)",
  content: "내용 (Content)",
  readAloud: "낭독 (Read-Aloud)",
  interaction: "상호작용 (Interaction)",
  compliance: "운영 (Compliance)",
};

export function criteriaForTask(task: TaskType): Criterion[] {
  return CRITERIA_CATALOG.filter((c) => c.appliesTo.includes(task));
}
