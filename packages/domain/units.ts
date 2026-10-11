export const MAX_U64 = (1n << 64n) - 1n;

export function pow10(decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error('DECIMALS_INVALID');
  return 10n ** BigInt(decimals);
}

export function parseUnits(input: string, decimals: number): bigint {
  const value = input.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(value)) throw new Error('Angka tidak valid. Gunakan satu pemisah desimal.');
  const [whole = '', fraction = ''] = value.replace(',', '.').split('.');
  if (fraction.length > decimals) throw new Error(`Maksimal ${decimals} angka desimal.`);
  return BigInt(whole) * pow10(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
}

export function formatUnits(raw: bigint, decimals: number, shown = decimals): string {
  const negative = raw < 0n;
  const abs = negative ? -raw : raw;
  const scale = pow10(decimals);
  const fraction = (abs % scale).toString().padStart(decimals, '0').slice(0, shown).replace(/0+$/, '');
  return `${negative ? '-' : ''}${abs / scale}${fraction ? `.${fraction}` : ''}`;
}

export function ceilDiv(n: bigint, d: bigint): bigint {
  if (n < 0n || d <= 0n) throw new Error('DIVISION_INVALID');
  return (n + d - 1n) / d;
}

export function integer(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  throw new Error('INTEGER_INVALID');
}

export function u64(value: unknown): bigint {
  const n = integer(value);
  if (n < 0n || n > MAX_U64) throw new Error('UINT64_INVALID');
  return n;
}

export function safeNumber(value: unknown): number {
  const n = integer(value);
  if (n < 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('WIRE_INTEGER_UNSUPPORTED');
  return Number(n);
}
