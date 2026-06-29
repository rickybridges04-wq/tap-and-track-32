import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { AGENTS } from "@/lib/agents";

export const Route = createFileRoute("/roster/agents")({
  component: AgentRoster,
  head: () => ({ meta: [{ title: "Agent roster · Walkthrough Wizard QAOS" }] }),
});

function AgentRoster() {
  const agents = Object.values(AGENTS);
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Agent roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {agents.length} AI operators available across the system.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((a) => (
            <div key={a.id} className="glass rounded-xl border border-border/60 p-4 btn-3d">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{a.emoji}</span>
                <div>
                  <div className={`font-semibold ${a.color}`}>{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.short}</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-snug line-clamp-4">{a.systemPrompt}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {a.tools.map((t) => (
                  <span key={t} className="text-[10px] rounded bg-muted/40 px-1.5 py-0.5 ring-1 ring-border/50">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
