import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { GRADE_LEVELS, PROFICIENCY_LEVELS, CATEGORIES } from "@/lib/levels";
import { TASK_TYPE_LABELS, type TaskType } from "@/lib/criteria";

// 지문·질문 생성 API (2단계). 서버에서만 실행되므로 API 키가 브라우저에 노출되지 않는다.
// 키는 .env.local 의 ANTHROPIC_API_KEY 에서 읽는다.

export const maxDuration = 120; // Vercel: 생성이 수십 초 걸릴 수 있음

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short English title of the passage" },
    passage: { type: "string", description: "The English passage/story/text" },
    passageKo: { type: "string", description: "Natural Korean translation of the passage, for the teacher" },
    vocabulary: {
      type: "array",
      description: "5-8 key words from the passage with Korean meanings",
      items: {
        type: "object",
        properties: {
          word: { type: "string" },
          meaning: { type: "string", description: "Korean meaning" },
        },
        required: ["word", "meaning"],
        additionalProperties: false,
      },
    },
    questions: {
      type: "array",
      description: "Questions with sample answers. Empty array if not applicable to the task type.",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          sampleAnswer: { type: "string", description: "A model answer at the student's level" },
        },
        required: ["question", "sampleAnswer"],
        additionalProperties: false,
      },
    },
    keyPoints: {
      type: "array",
      description: "Key content points a good retelling should include (Korean). Empty array if not retelling.",
      items: { type: "string" },
    },
  },
  required: ["title", "passage", "passageKo", "vocabulary", "questions", "keyPoints"],
  additionalProperties: false,
} as const;

const TASK_INSTRUCTIONS: Record<TaskType, string> = {
  retelling: `Write a STORY suitable for retelling: a clear sequence of events, distinct characters, and a satisfying ending. The student will read or listen to it once, then retell it in their own words.
- Provide 4-6 keyPoints (in Korean): the essential events/facts a good retelling must include, in order.
- Provide 2 simple comprehension questions with sample answers.`,
  readAloud: `Write a PASSAGE for reading aloud (낭독). Include varied sentence lengths, natural punctuation (commas, questions, exclamations) and, if appropriate, a line or two of dialogue — so phrasing and expressiveness can be assessed.
- questions: empty array. keyPoints: empty array.`,
  qna: `Create an INTERVIEW-style task. The "passage" field should contain a short topic introduction (2-3 sentences) the student reads first.
- Provide 4-5 interview questions about the topic and the student's own experience/opinion, ordered from easy to hard, each with a sampleAnswer at the student's level.
- keyPoints: empty array.`,
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. 프로젝트 폴더의 .env.local 파일에 키를 넣어주세요. (.env.example 참고)" },
      { status: 500 },
    );
  }

  let body: {
    taskType?: TaskType;
    gradeId?: string;
    proficiencyId?: string;
    category?: string;
    keywords?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const grade = GRADE_LEVELS.find((g) => g.id === body.gradeId);
  const taskType = body.taskType;
  if (!grade || !taskType || !(taskType in TASK_TYPE_LABELS)) {
    return NextResponse.json({ error: "학년과 과제 유형을 선택해주세요." }, { status: 400 });
  }
  if (!body.category && !body.keywords?.trim()) {
    return NextResponse.json({ error: "카테고리를 고르거나 키워드를 입력해주세요." }, { status: 400 });
  }

  const proficiency = PROFICIENCY_LEVELS.find((p) => p.id === body.proficiencyId);
  const categoryLabel = CATEGORIES.find((c) => c.id === body.category)?.label;

  const topicLine = body.keywords?.trim()
    ? `Topic: build the content around these teacher-given keywords: "${body.keywords.trim()}".`
    : `Topic category: ${categoryLabel} (${body.category}). Choose a fresh, engaging topic within this category.`;

  const levelLine = proficiency
    ? `Language level: target ${proficiency.label} (Lexile ${proficiency.lexile}, IELTS ${proficiency.ielts}). ${proficiency.promptHint} The student's school grade (${grade.label}) tells you their age and interests; the CEFR level overrides grade for language difficulty.`
    : `Language level: ${grade.promptHint}`;

  const userPrompt = `Create speaking-assessment material for a Korean student.

Task type: ${taskType} (${TASK_TYPE_LABELS[taskType]})
Student: ${grade.label} (Korean school grade)
${levelLine}
Passage length: about ${grade.targetWords[0]}-${grade.targetWords[1]} English words.
${topicLine}

${TASK_INSTRUCTIONS[taskType]}

Constraints:
- Content must be age-appropriate, culturally neutral or Korea-friendly, and engaging for this age.
- Avoid vocabulary far above the target level; when a slightly harder word is needed, make its meaning clear from context and include it in vocabulary.
- Do not include the title inside the passage text.`;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system:
        "You are an expert ESL content writer for Korean students (초1~고3). You write natural, level-appropriate English passages and questions for speaking assessments, calibrated precisely to the requested difficulty.",
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "생성에 실패했습니다. 다른 키워드나 카테고리로 다시 시도해주세요." }, { status: 502 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "생성 결과가 비어 있습니다. 다시 시도해주세요." }, { status: 502 });
    }

    return NextResponse.json({ result: JSON.parse(textBlock.text) });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "API 키가 올바르지 않습니다. .env.local의 ANTHROPIC_API_KEY를 확인해주세요." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "요청이 몰려 잠시 제한되었습니다. 1분 후 다시 시도해주세요." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI 서비스 오류 (${error.status}). 잠시 후 다시 시도해주세요.` }, { status: 502 });
    }
    return NextResponse.json({ error: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요." }, { status: 500 });
  }
}
