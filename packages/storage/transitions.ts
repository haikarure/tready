import type { JournalRow, RequestState } from '../execution/coordinator';

// Venue failure may be followed by success. A confirmed non-failure outcome is final;
// transport acknowledgments and disconnects may never regress it.
const sources: Record<RequestState, readonly RequestState[]> = {
  prepared: ['prepared'],
  sent: ['prepared', 'sent'],
  forwarded: ['prepared', 'sent', 'forwarded'],
  unknown: ['prepared', 'sent', 'forwarded', 'unknown'],
  failed: ['prepared', 'sent', 'forwarded', 'unknown', 'failed'],
  settled: ['prepared', 'sent', 'forwarded', 'unknown', 'failed'],
};
export function journalTransition(row: JournalRow, status: RequestState, reason?: string, seen?: boolean): JournalRow | null {
  if (seen === true && status !== 'settled' || status === 'settled' && seen === false) throw new Error('JOURNAL_OUTCOME_INVALID');
  if (row.nonFailureSeen || !sources[status].includes(row.status)) return null;
  return { ...row, status, reason: reason ?? row.reason, nonFailureSeen: status === 'settled' };
}
export function journalUpdate(id: string, status: RequestState, reason?: string, seen?: boolean): { sql: string; params: Array<string | number | null> } {
  if (seen === true && status !== 'settled' || status === 'settled' && seen === false) throw new Error('JOURNAL_OUTCOME_INVALID');
  const allowed = sources[status];
  return {
    sql: `UPDATE requests SET status=?,reason=COALESCE(?,reason),seen=? WHERE id=? AND seen=0 AND status IN (${allowed.map(() => '?').join(',')})`,
    params: [status, reason ?? null, status === 'settled' ? 1 : 0, id, ...allowed],
  };
}
export const recoverJournalSql = "UPDATE requests SET status='settled' WHERE seen=1 AND status!='settled'; UPDATE requests SET status='unknown',reason='App restart: rekonsiliasi diperlukan.' WHERE seen=0 AND status IN ('prepared','sent','forwarded');";
