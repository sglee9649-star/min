import { NextResponse } from "next/server";

// 음성 → 텍스트 (4단계). OpenAI Whisper API 사용.
// 키는 .env.local / Vercel 환경변수의 OPENAI_API_KEY 에서 읽는다.

export const maxDuration = 120;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY가 설정되지 않았습니다. Vercel 프로젝트 설정 → Environment Variables에 키를 추가하고 재배포해주세요." },
      { status: 500 },
    );
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    const f = formData.get("file");
    if (f instanceof File) file = f;
  } catch {
    /* 아래에서 공통 처리 */
  }
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "녹음 파일이 비어 있습니다." }, { status: 400 });
  }
  if (file.size > 24 * 1024 * 1024) {
    return NextResponse.json({ error: "녹음 파일이 너무 큽니다 (24MB 초과)." }, { status: 400 });
  }

  const fd = new FormData();
  fd.append("file", file, file.name || "recording.webm");
  fd.append("model", "whisper-1");
  fd.append("language", "en");
  fd.append("temperature", "0");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });

    if (res.status === 401) {
      return NextResponse.json({ error: "OpenAI API 키가 올바르지 않습니다. OPENAI_API_KEY를 확인해주세요." }, { status: 500 });
    }
    if (res.status === 429) {
      return NextResponse.json({ error: "OpenAI 요청이 잠시 제한되었습니다. 1분 후 다시 시도해주세요." }, { status: 429 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: `음성 인식 서비스 오류 (${res.status}). 잠시 후 다시 시도해주세요.` }, { status: 502 });
    }

    const data = (await res.json()) as { text?: string };
    return NextResponse.json({ text: (data.text ?? "").trim() });
  } catch {
    return NextResponse.json({ error: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
