import type { ConnectionDb } from "./store";
export async function auditAdminRead(
  pool: ConnectionDb,
  actor: {
    connectionId: string;
    account: { id: string };
    config: { clientId: string };
  },
  tool: string,
  outcome: "started" | "completed" | "denied" | "failed",
) {
  // No raw arguments, returned records, tokens, prompts or private notes in audit metadata.
  await pool.query(
    `INSERT INTO public.ai_connection_audit(actor_user_id,connection_id,client_id,tool,outcome) VALUES($1,$2::uuid,$3,$4,$5)`,
    [
      actor.account.id,
      actor.connectionId,
      actor.config.clientId,
      tool,
      outcome,
    ],
  );
}
