import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { criteriaForTask, TASK_TYPE_LABELS, type TaskType } from "@/lib/criteria";

// AI 평가 (4단계): 전사본을 평가항목별로 채점하고 근거 문장을 함께 출력한다.
// 전사본(글)으로 판단 가능한 항목만 채점한다 — 발음·억양 등 소리 항목은 심사위원 몫.
// AI 점수는 참고용이며, 심사위원 점수와의 반영 비율은 6단계 집계에서 관리자가 설정한다.

export const maxDuration = 120;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      description: "One entry per criterion, in the same order as given",
      items: {
        type: "object",
        properties: {
          criterionId: { type: "string" },
          score: { type: "integer", description: "0 to 5" },
          evidence: { type: "string", description: "Direct quote(s) from the transcript supporting the score. If nothing relevant exists, describe what is missing." },
          comment: { type: "string", description: "Korean. 1-2 sentences: why this score, and one concrete improvement tip." },
        },
        required: ["criterionId", "score", "evidence", "comment"],
        additionalProperties: false,
      },
    },
    overallComment: {
      type: "string",
      description: "Korean. 3-5 sentences: overall strengths, main areas to improve, encouraging closing. Written for the teacher and student.",
    },
  },
  required: ["scores", "overallComment"],
  additionalProperties: false,
} as const;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. 환경변수를 확인해주세요." },
      { status: 500 },
    );
  }

  let body: {
    taskType?: TaskType;
    transcript?: string;
    passage?: string;
    keyPoints?: string[];
    questions?: { question: string; sampleAnswer: string }[];
    durationSec?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { taskType, transcript, passage } = body;
  if (!taskType || !(taskType in TASK_TYPE_LABELS) || !passage) {
    return NextResponse.json({ error: "과제 유형과 지문 정보가 필요합니다." }, { status: 400 });
  }
  if (!transcript?.trim()) {
    return NextResponse.json({ error: "전사본이 비어 있습니다. 녹음에 목소리가 담겼는지 확인해주세요." }, { status: 400 });
  }

  const criteria = criteriaForTask(taskType).filter((c) => c.aiEvaluable);

  const criteriaBlock = criteria
    .map((c) => `- id: ${c.id} | ${c.nameEn} (${c.name}): ${c.description}`)
    .join("\n");

  const extras: string[] = [];
  if (taskType === "retelling" && body.keyPoints?.length) {
    extras.push(`Key points a good retelling should include:\n${body.keyPoints.map((k, i) => `${i + 1}. ${k}`).join("\n")}`);
  }
  if (taskType === "qna" && body.questions?.length) {
    extras.push(`Interview questions the student was answering:\n${body.questions.map((q, i) => `Q${i + 1}. ${q.question}`).join("\n")}`);
  }
  if (body.durationSec) {
    extras.push(`Speaking duration: about ${body.durationSec} seconds.`);
  }

  const userPrompt = `Evaluate a Korean student's English speaking performance from its transcript.

Task type: ${taskType} (${TASK_TYPE_LABELS[taskType]})

Original passage/prompt given to the student:
"""
${passage}
"""
${extras.length ? "\n" + extras.join("\n\n") + "\n" : ""}
Transcript of the student's speech (from Whisper; punctuation may be imperfect and some pronunciation errors may have been auto-corrected — judge only what is observable in the text):
"""
${transcript.trim()}
"""

Score each criterion below from 0 to 5 (integers only):
${criteriaBlock}

Rules:
- 5 = excellent for the level implied by the passage difficulty; 3 = adequate; 1 = attempted but weak; 0 = absent/off-task.
- Calibrate to the passage's difficulty level — this is a young learner, not a native adult.
- "evidence" MUST quote actual words from the transcript (or state precisely what is missing). Never invent quotes.
- If the transcript is empty-ish, off-topic, or clearly not an attempt at the task, give 0-1 scores and explain.
- Comments and overallComment in Korean, warm but honest, with concrete improvement tips.
- Return scores for exactly the ${criteria.length} criteria listed, using their exact ids.`;

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system:
        "You are an experienced ESL speaking examiner for Korean students. You score fairly and consistently against the given rubric, always grounding every score in quoted evidence from the transcript.",
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason !== "end_turn") {
      return NextResponse.json({ error: "채점에 실패했습니다. 다시 시도해주세요." }, { status: 502 });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "채점 결과가 비어 있습니다. 다시 시도해주세요." }, { status: 502 });
    }

    const parsed = JSON.parse(textBlock.text) as {
      scores: { criterionId: string; score: number; evidence: string; comment: string }[];
      overallComment: string;
    };

    // 점수 범위 보정 + 카탈로그에 없는 항목 제거
    const validIds = new Set(criteria.map((c) => c.id));
    const scores = parsed.scores
      .filter((s) => validIds.has(s.criterionId))
      .map((s) => ({ ...s, score: Math.max(0, Math.min(5, Math.round(s.score))) }));

    if (scores.length === 0) {
      return NextResponse.json({ error: "채점 결과가 올바르지 않습니다. 다시 시도해주세요." }, { status: 502 });
    }

    const totalScore = Math.round((scores.reduce((sum, s) => sum + s.score, 0) / (scores.length * 5)) * 100);

    return NextResponse.json({
      evaluation: {
        model: response.model,
        createdAt: new Date().toISOString(),
        totalScore,
        scores,
        overallComment: parsed.overallComment,
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Anthropic API 키가 올바르지 않습니다." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "요청이 몰려 잠시 제한되었습니다. 1분 후 다시 시도해주세요." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json({ error: `AI 서비스 오류 (${error.status}). 잠시 후 다시 시도해주세요.` }, { status: 502 });
    }
    return NextResponse.json({ error: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
