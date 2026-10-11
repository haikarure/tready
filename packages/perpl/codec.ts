import { parse, stringify, LosslessNumber } from 'lossless-json';
import { safeNumber, u64 } from '../domain/units';

export function decode(text: string): unknown {
  return parse(text, undefined, value => {
    if (/^-?\d+$/.test(value)) { const n = BigInt(value); return n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n; }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error('NUMBER_INVALID');
    return n;
  });
}
export function encode(value: unknown): string {
  const output = stringify(value, (_key, item) => typeof item === 'bigint' ? new LosslessNumber(item.toString()) : item);
  if (typeof output !== 'string') throw new Error('WIRE_VALUE_INVALID');
  return output;
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SCHEMA_OBJECT_EXPECTED');
  return value as Record<string, unknown>;
}
export function list(value: unknown): unknown[] { if (!Array.isArray(value)) throw new Error('SCHEMA_ARRAY_EXPECTED'); return value; }
export function text(value: unknown): string { if (typeof value !== 'string') throw new Error('SCHEMA_STRING_EXPECTED'); return value; }
export function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('SCHEMA_BOOL_EXPECTED'); return value; }
export { safeNumber, u64 };
