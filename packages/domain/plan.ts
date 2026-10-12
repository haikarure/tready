import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { RiskInput, RiskQuote } from './risk';

export function canonical(value: unknown): string {
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('CANONICAL_VALUE_INVALID');
  return encoded;
}
export function digest(value: unknown): string { return bytesToHex(sha256(utf8ToBytes(canonical(value)))); }
export interface Binding { chainId: 10143; instanceId: string; exchange: string; collateral: string; marketId: string; perpetualId: string; accountId: string; wallet: string }
export interface Plan { version: 1; id: string; revision: number; binding: Binding; input: RiskInput; quote: RiskQuote; configDigest: string; bookBlock: string; receivedAt: number; expiresAt: number }
export interface Approval { planDigest: string; approvedAt: number; sessionId: string }
export function approve(plan: Plan, sessionId: string, now: number): Approval {
  if (!plan.quote.executable || !sessionId || !Number.isSafeInteger(now) || now<plan.receivedAt || now > plan.expiresAt) throw new Error('PLAN_NOT_EXECUTABLE_OR_EXPIRED');
  return { planDigest: digest(plan), approvedAt: now, sessionId };
}
export function assertApproval(plan: Plan, approval: Approval, sessionId: string, now: number): void {
  if (approval.planDigest !== digest(plan) || !sessionId || approval.sessionId !== sessionId || !Number.isSafeInteger(approval.approvedAt) || approval.approvedAt<plan.receivedAt || approval.approvedAt>now || now > plan.expiresAt || !plan.quote.executable) throw new Error('PLAN_REVIEW_REQUIRED');
}
