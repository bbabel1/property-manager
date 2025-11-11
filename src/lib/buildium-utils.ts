const ID_CANDIDATE_KEYS = [
  'FileId',
  'FileID',
  'fileId',
  'fileID',
  'DocumentId',
  'DocumentID',
  'documentId',
  'documentID',
  'Id',
  'ID',
  'id',
] as const;

const NESTED_KEYS = ['File', 'file', 'Result', 'result', 'Data', 'data', 'Value', 'value'] as const;

const parseNumericId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/\d+/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

const extractFromRecord = (record: Record<string, unknown>): number | null => {
  for (const key of ID_CANDIDATE_KEYS) {
    if (key in record) {
      const id = parseNumericId(record[key]);
      if (id) return id;
    }
  }

  if (typeof record.PhysicalFileName === 'string') {
    const id = parseNumericId(record.PhysicalFileName);
    if (id) return id;
  }

  if (typeof record.Href === 'string') {
    const match = record.Href.match(/\/(\d+)(?:\?|$)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return null;
};

export function extractBuildiumFileIdFromPayload(payload: unknown): number | null {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const candidate = extractBuildiumFileIdFromPayload(entry);
      if (candidate) return candidate;
    }
    return null;
  }

  if (typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const primary = extractFromRecord(record);
  if (primary) return primary;

  for (const nestedKey of NESTED_KEYS) {
    if (nestedKey in record) {
      const nested = record[nestedKey];
      const candidate = extractBuildiumFileIdFromPayload(nested);
      if (candidate) return candidate;
    }
  }

  return null;
}
