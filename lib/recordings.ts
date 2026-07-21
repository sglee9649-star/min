// 녹음 저장소 — IndexedDB(브라우저 내장 DB)에 로컬 우선 저장.
// 현장 와이파이 장애 대비: 녹음은 항상 기기에 먼저 저장되고,
// 서버 업로드는 Supabase 도입 단계에서 추가한다 (uploaded 플래그로 관리).
import type { TaskType } from "./criteria";

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
