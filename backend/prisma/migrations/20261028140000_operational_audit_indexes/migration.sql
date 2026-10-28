-- Supports the Phase 11 action-filtered audit timeline.
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
