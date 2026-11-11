import type { Tx } from "@/server/db/client";

/** Append-only audit trail (users can insert and read their own rows, never update/delete). */
export async function audit(tx: Tx, action: string, entityType?: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  await tx`insert into audit_logs (action, entity_type, entity_id, metadata)
           values (${action}, ${entityType ?? null}, ${entityId ?? null}, ${tx.json(metadata as never)})`;
}
