export interface AccessPolicy { enabled: boolean; reason: string; checkedAt: number; offlineGraceMs?: number }
/** In-memory lease: switching accounts or restarting never carries another user's permission. */
export class AccessGate {
  private policy?: AccessPolicy;
  private receivedAt = 0;
  private generation = 0;
  private pending?: Promise<void>;
  constructor(private fetchPolicy: () => Promise<AccessPolicy>, private clock = Date.now) {}
  reset() { this.generation++; this.policy = undefined; this.receivedAt = 0; this.pending = undefined; }
  current() { return this.policy; }
  async refresh() {
    if (this.pending) return this.pending;
    const generation = this.generation;
    const task = (async () => {
      const policy = await this.fetchPolicy();
      if (generation !== this.generation) throw new Error('تغير حساب FLIX؛ أعد المحاولة.');
      if (typeof policy?.enabled !== 'boolean') throw new Error('لم يؤكد الخادم صلاحية الريموت.');
      this.policy = policy; this.receivedAt = this.clock();
    })();
    this.pending = task;
    try { await task; } finally { if (this.pending === task) this.pending = undefined; }
  }
  async assertAllowed() {
    if (!this.policy || this.clock()-this.receivedAt >= 30000) {
      try { await this.refresh(); }
      catch (error) {
        // At most five minutes of known permission during an outage; never allow a known block.
        if (!this.policy?.enabled || this.clock()-this.receivedAt >= (this.policy.offlineGraceMs ?? 300000)) throw error;
      }
    }
    if (!this.policy?.enabled) throw new Error(this.policy?.reason || 'أوقف مسؤول FLIX الوصول إلى الريموت.');
  }
}
