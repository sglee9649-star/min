// QR/링크 출제: 문제와 타이머 설정을 URL 자체에 담아 다른 기기로 전달한다.
// 서버 없이 동작하므로 현장 네트워크 상태와 무관하게 안정적이다.
// (Supabase 도입 후에는 실시간 출제로 대체·병행 예정)
import type { TaskType } from "./criteria";
import type { GeneratedProblem } from "./problems";
import type { ContestSettings } from "./settings";

// URL 크기를 줄이기 위해 참가자에게 필요한 필드만 담는다
export interface SharedProblemSlim {
  id: string;
  taskType: TaskType;
  title: string;
  passage: string;
  questions: { question: string; sampleAnswer: string }[];
}

export interface SharedPayload {
  problem: SharedProblemSlim;
  settings: ContestSettings;
}

// 참가번호별 배정 출제 전체를 담는 페이로드 (링크 공유용)
export interface SharedAssignmentPayload {
  problems: SharedProblemSlim[];
  map: Record<string, string>; // 참가번호 → 문제 id
  settings: ContestSettings;
}

const b64urlEncode = (bytes: Uint8Array): string => {
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const b64urlDecode = (s: string): Uint8Array => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const blob = new Blob([bytes as BlobPart]);
  const compressed = blob.stream().pipeThrough(stream);
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

export async function buildShareHash(problem: GeneratedProblem, settings: ContestSettings): Promise<string> {
  const payload: SharedPayload = {
    problem: {
      id: problem.id,
      taskType: problem.taskType,
      title: problem.title,
      passage: problem.passage,
      questions: problem.taskType === "qna" ? problem.questions : [],
    },
    settings,
  };
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  try {
    const deflated = await pipeThrough(raw, new CompressionStream("deflate-raw"));
    return `#p=c:${b64urlEncode(deflated)}`;
  } catch {
    // 구형 브라우저: 압축 없이 전달 (QR이 조금 촘촘해질 뿐 동작은 동일)
    return `#p=u:${b64urlEncode(raw)}`;
  }
}

export async function parseShareHash(hash: string): Promise<SharedPayload | null> {
  const m = hash.match(/#p=([cu]):(.+)$/);
  if (!m) return null;
  try {
    const bytes = b64urlDecode(m[2]);
    const raw = m[1] === "c"
      ? await pipeThrough(bytes, new DecompressionStream("deflate-raw"))
      : bytes;
    const payload = JSON.parse(new TextDecoder().decode(raw)) as SharedPayload;
    if (!payload?.problem?.passage || !payload?.settings) return null;
    return payload;
  } catch {
    return null;
  }
}

const slim = (p: GeneratedProblem): SharedProblemSlim => ({
  id: p.id,
  taskType: p.taskType,
  title: p.title,
  passage: p.passage,
  questions: p.taskType === "qna" ? p.questions : [],
});

// 배정 출제 전체 링크 (#a=): 태블릿에서 한 번 열면 모든 배정이 그 기기에 저장된다
export async function buildAssignmentShareHash(
  problems: GeneratedProblem[],
  map: Record<string, string>,
  settings: ContestSettings,
): Promise<string> {
  const payload: SharedAssignmentPayload = { problems: problems.map(slim), map, settings };
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  try {
    const deflated = await pipeThrough(raw, new CompressionStream("deflate-raw"));
    return `#a=c:${b64urlEncode(deflated)}`;
  } catch {
    return `#a=u:${b64urlEncode(raw)}`;
  }
}

export async function parseAssignmentShareHash(hash: string): Promise<SharedAssignmentPayload | null> {
  const m = hash.match(/#a=([cu]):(.+)$/);
  if (!m) return null;
  try {
    const bytes = b64urlDecode(m[2]);
    const raw = m[1] === "c"
      ? await pipeThrough(bytes, new DecompressionStream("deflate-raw"))
      : bytes;
    const payload = JSON.parse(new TextDecoder().decode(raw)) as SharedAssignmentPayload;
    if (!payload?.problems?.length || !payload?.map || !payload?.settings) return null;
    return payload;
  } catch {
    return null;
  }
}
