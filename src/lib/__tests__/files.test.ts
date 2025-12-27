import { describe, expect, it } from 'vitest';

import {
  FILE_ENTITY_TYPES,
  resolveFileEntityFromRow,
  type EntityTypeEnum,
} from '../files';

type TestFile = {
  entity_type: string | null;
  entity_id: number | string | null;
  storage_key?: string | null;
};

describe('resolveFileEntityFromRow', () => {
  it('uses entity_type and entity_id when present', () => {
    const file: TestFile = {
      entity_type: FILE_ENTITY_TYPES.PROPERTIES,
      entity_id: 42,
    };

    const { entityType, entityId } = resolveFileEntityFromRow(file);

    expect(entityType).toBe(FILE_ENTITY_TYPES.PROPERTIES as EntityTypeEnum);
    expect(entityId).toBe(42);
  });

  it('normalizes Buildium-style entity type strings', () => {
    const file: TestFile = {
      entity_type: 'Rental',
      entity_id: 11,
    };

    const { entityType, entityId } = resolveFileEntityFromRow(file);

    expect(entityType).toBe(FILE_ENTITY_TYPES.PROPERTIES as EntityTypeEnum);
    expect(entityId).toBe(11);
  });

  it('derives unit entity from storage_key with UUID', () => {
    const unitId = '11111111-1111-1111-1111-111111111111';
    const file: TestFile = {
      entity_type: null,
      entity_id: null,
      storage_key: `unit/${unitId}/lease-doc.pdf`,
    };

    const { entityType, entityId } = resolveFileEntityFromRow(file);

    expect(entityType).toBe(FILE_ENTITY_TYPES.UNITS as EntityTypeEnum);
    expect(entityId).toBe(unitId);
  });

  it('derives lease entity and numeric id from storage_key', () => {
    const file: TestFile = {
      entity_type: null,
      entity_id: null,
      storage_key: 'lease/1234/statement.pdf',
    };

    const { entityType, entityId } = resolveFileEntityFromRow(file);

    expect(entityType).toBe(FILE_ENTITY_TYPES.LEASES as EntityTypeEnum);
    expect(entityId).toBe(1234);
  });

  it('falls back to nulls when it cannot infer an entity', () => {
    const file: TestFile = {
      entity_type: null,
      entity_id: null,
      storage_key: 'unknown/abc/file.pdf',
    };

    const { entityType, entityId } = resolveFileEntityFromRow(file);

    expect(entityType).toBeNull();
    expect(entityId).toBeNull();
  });
});

