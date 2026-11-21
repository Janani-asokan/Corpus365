import type { Executor } from "@/server/db/client";
import { auditEvents } from "@/server/db/schema";

export async function audit(
  executor: Executor,
  event: { actorId: string | null; action: string; entityId?: string; detail?: string },
): Promise<void> {
  await executor.insert(auditEvents).values({ actorId: event.actorId, action: event.action, entityId: event.entityId, detail: event.detail });
}
