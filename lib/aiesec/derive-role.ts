import type { UserRole } from "@/app/generated/prisma/enums";

// Pure function: GIS currentPerson response → 'MCP' | 'MEMBER'.
// Rule to confirm with MC IM: likely current_positions[].role.name === "MCP"
// or role level matches MC tier.
// TODO: implement and add unit tests against GIS fixture responses.
export function deriveRole(_person: unknown): UserRole {
  throw new Error("deriveRole not yet implemented");
}
