import { AppDataSource } from '../config/database.ts';
import { AuditTrail } from '../models/AuditTrail.js';

export function startAuditRetentionJob() {
  const repo = AppDataSource.getRepository(AuditTrail);
  const run = async () => {
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await repo.createQueryBuilder()
        .delete()
        .from(AuditTrail)
        .where('timestamp < :cutoff', { cutoff })
        .execute();
    } catch (e) {
      // ignore
    } finally {
      setTimeout(run, 24 * 60 * 60 * 1000);
    }
  };
  run();
}
