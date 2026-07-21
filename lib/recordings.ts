// 녹음 저장소 — IndexedDB(브라우저 내장 DB)에 로컬 우선 저장.
// 현장 와이파이 장애 대비: 녹음은 항상 기기에 먼저 저장되고,
// 서버 업로드는 Supabase 도입 단계에서 추가한다 (uploaded 플래그로 관리).
import type { TaskType } from "./criteria";

// AI 평가 결과 (4단계). 전사본 기반이라 내용·언어 항목만 채점하며,
// 점수마다 전사본에서 뽑은 근거가 반드시 붙는다. AI 점수는 참고용.
export interface AiEvaluation {
  model: string;
  createdAt: string;
  totalScore: number; // 100점 환산 (채점된 항목 평균)
  scores: {
    criterionId: string;
    score: number; // 0~5
    evidence: string; // 전사본에서 인용한 근거 (영어)
    comment: string; // 한국어 코멘트
  }[];
  overallComment: string; // 한국어 총평 + 개선 조언
}

export interface RecordingMeta {
  id: string;
  participantNumber: string;
  problemId: string;
  problemTitle: string;
  taskType: TaskType;
  attempt: number; // 1부터. 2 이상이면 재녹음
  retryReason?: string; // 재녹음 사유 (재시도 로그)
  createdAt: string;
  durationSec: number;
  mimeType: string;
  uploaded: boolean;
  // AI 평가에 필요한 문제 내용을 녹음에 함께 보관 (다른 기기에서 평가해도 문제를 찾을 수 있게)
  problemPassage?: string;
  problemKeyPoints?: string[];
  problemQuestions?: { question: string; sampleAnswer: string }[];
  // 4단계 결과
  transcript?: string;
  evaluation?: AiEvaluation;
}

export interface RecordingEntry extends RecordingMeta {
  blob: Blob;
}

const DB_NAME = "speaking-app";
const STORE = "recordings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(entry: RecordingEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listRecordings(): Promise<RecordingEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = req.result as RecordingEntry[];
      all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(all);
    };
    req.onerror = () => reject(req.error);
  });
}

// 전사본·평가 결과 등 일부 필드만 갱신
export async function updateRecording(id: string, patch: Partial<RecordingMeta>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const entry = getReq.result as RecordingEntry | undefined;
      if (entry) store.put({ ...entry, ...patch });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 브라우저별 지원 포맷 선택 (아이패드 Safari는 mp4만 되는 경우가 있음)
export function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}
