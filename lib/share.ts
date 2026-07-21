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

// ---------- 공용 인코딩 ----------
// 어떤 데이터든 "#<접두어>=c:..." 형태의 URL 해시로 압축해 담는다.
// 출제(p/a), 심사 설정(j), 채점 결과(s) 공유가 모두 이 방식을 쓴다.
export async function encodeHashPayload(prefix: string, obj: unknown): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  try {
    const deflated = await pipeThrough(raw, new CompressionStream("deflate-raw"));
    return `#${prefix}=c:${b64urlEncode(deflated)}`;
  } catch {
    // 구형 브라우저: 압축 없이 전달
    return `#${prefix}=u:${b64urlEncode(raw)}`;
  }
}

export async function parseHashPayload<T>(prefix: string, hash: string): Promise<T | null> {
  const m = hash.match(new RegExp(`#${prefix}=([cu]):(.+)$`));
  if (!m) return null;
  try {
    const bytes = b64urlDecode(m[2]);
    const raw = m[1] === "c"
      ? await pipeThrough(bytes, new DecompressionStream("deflate-raw"))
      : bytes;
    return JSON.parse(new TextDecoder().decode(raw)) as T;
  } catch {
    return null;
  }
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
  return encodeHashPayload("p", payload);
}

export async function parseShareHash(hash: string): Promise<SharedPayload | null> {
  const payload = await parseHashPayload<SharedPayload>("p", hash);
  if (!payload?.problem?.passage || !payload?.settings) return null;
  return payload;
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
  return encodeHashPayload("a", payload);
}

export async function parseAssignmentShareHash(hash: string): Promise<SharedAssignmentPayload | null> {
  const payload = await parseHashPayload<SharedAssignmentPayload>("a", hash);
  if (!payload?.problems?.length || !payload?.map || !payload?.settings) return null;
  return payload;
}
