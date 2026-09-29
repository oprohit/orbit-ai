import { asc } from "drizzle-orm";
import { db } from "@/db";
import { mcpServers, mcpTools } from "@/db/schema";
import McpHubClient from "@/components/McpHubClient";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const servers = await db.select().from(mcpServers).orderBy(asc(mcpServers.id));
  const allTools = await db.select().from(mcpTools);

  return <McpHubClient initialServers={servers} allTools={allTools} />;
}
