import type { Executor } from "@/server/db/client";
import { auditEvents } from "@/server/db/schema";

export function audit(
  executor: Executor,
  event: { actorId: string | null; action: string; entityId?: string; detail?: string },
): void {
  executor
    .insert(auditEvents)
    .values({ actorId: event.actorId, action: event.action, entityId: event.entityId, detail: event.detail })
    .run();
}
