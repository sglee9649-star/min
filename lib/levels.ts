// 난이도(학년/레벨)와 카테고리 정의 — 문제 생성(2단계)에서 사용.
// 한국인 학습자 기준. targetWords는 생성 지문의 대략적 길이(단어 수) 가이드.

export interface GradeLevel {
  id: string;
  label: string;
  targetWords: [number, number]; // [최소, 최대]
  promptHint: string; // AI에게 주는 난이도 설명 (영어)
}

export const GRADE_LEVELS: GradeLevel[] = [
  { id: "e1", label: "초1", targetWords: [30, 50], promptHint: "Korean 1st grader (age 7), pre-A1. Very simple present-tense sentences of 3-6 words, basic sight words only." },
  { id: "e2", label: "초2", targetWords: [40, 60], promptHint: "Korean 2nd grader (age 8), pre-A1/A1. Simple sentences, common everyday vocabulary, lots of repetition." },
  { id: "e3", label: "초3", targetWords: [50, 80], promptHint: "Korean 3rd grader (age 9), A1. Simple past tense allowed, short connected sentences." },
  { id: "e4", label: "초4", targetWords: [70, 100], promptHint: "Korean 4th grader (age 10), A1/A2. Basic connectors (and, but, because), familiar topics." },
  { id: "e5", label: "초5", targetWords: [90, 130], promptHint: "Korean 5th grader (age 11), A2. Clear paragraph structure, some new vocabulary with context clues." },
  { id: "e6", label: "초6", targetWords: [110, 150], promptHint: "Korean 6th grader (age 12), A2/B1. Longer narrative arcs, varied sentence patterns." },
  { id: "m1", label: "중1", targetWords: [130, 180], promptHint: "Korean 7th grader (age 13), B1. Multiple paragraphs, cause-effect relationships, moderate academic vocabulary." },
  { id: "m2", label: "중2", targetWords: [150, 200], promptHint: "Korean 8th grader (age 14), B1. Abstract ideas introduced gently, idiomatic phrases with context." },
  { id: "m3", label: "중3", targetWords: [170, 220], promptHint: "Korean 9th grader (age 15), B1/B2. Argumentative or informational text possible, complex sentences." },
  { id: "h1", label: "고1", targetWords: [190, 250], promptHint: "Korean 10th grader (age 16), B2. Academic register, nuanced vocabulary, inference required." },
  { id: "h2", label: "고2", targetWords: [210, 280], promptHint: "Korean 11th grader (age 17), B2/C1. Sophisticated structure, topic-specific terminology." },
  { id: "h3", label: "고3", targetWords: [230, 300], promptHint: "Korean 12th grader (age 18), C1. Near-native complexity, editorial or literary style acceptable." },
];

export interface ProficiencyLevel {
  id: string;
  label: string; // CEFR
  lexile: string;
  ielts: string;
  promptHint: string;
}

// 선택 항목: 학년과 별개로 실력 레벨을 지정하고 싶을 때 사용 (예: 초5인데 B1 수준)
export const PROFICIENCY_LEVELS: ProficiencyLevel[] = [
  { id: "preA1", label: "Pre-A1", lexile: "BR~200L", ielts: "-", promptHint: "Absolute beginner. Words and formulaic phrases only." },
  { id: "a1", label: "A1", lexile: "200~400L", ielts: "~2.5", promptHint: "Beginner. Simple sentences about familiar things." },
  { id: "a2", label: "A2", lexile: "400~600L", ielts: "3.0~3.5", promptHint: "Elementary. Everyday topics, simple connected text." },
  { id: "b1", label: "B1", lexile: "600~850L", ielts: "4.0~5.0", promptHint: "Intermediate. Main points of clear standard input." },
  { id: "b2", label: "B2", lexile: "850~1050L", ielts: "5.5~6.5", promptHint: "Upper-intermediate. Complex text, abstract topics." },
  { id: "c1", label: "C1", lexile: "1050L+", ielts: "7.0+", promptHint: "Advanced. Demanding, longer texts with implicit meaning." },
];

export const CATEGORIES: { id: string; label: string }[] = [
  { id: "animals", label: "동물·자연" },
  { id: "friendship", label: "우정·가족" },
  { id: "school", label: "학교생활" },
  { id: "adventure", label: "모험·판타지" },
  { id: "science", label: "과학·발명" },
  { id: "sports", label: "스포츠·취미" },
  { id: "food", label: "음식·요리" },
  { id: "travel", label: "여행·세계문화" },
  { id: "environment", label: "환경·지구" },
  { id: "history", label: "역사·인물" },
  { id: "dailylife", label: "일상·습관" },
  { id: "folktale", label: "전래동화·우화" },
];
