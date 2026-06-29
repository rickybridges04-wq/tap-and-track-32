import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PERSONAS } from "@/lib/qa/personas";

export const Route = createFileRoute("/roster/personas")({
  component: PersonaRoster,
  head: () => ({ meta: [{ title: "Persona roster · Walkthrough Wizard QAOS" }] }),
});

function PersonaRoster() {
  const personas = Object.values(PERSONAS);
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Beta tester personas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {personas.length} personas evaluate every crawl through their own lens.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {personas.map((p) => (
            <div key={p.id} className="glass rounded-xl border border-border/60 p-4 btn-3d">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{p.emoji}</span>
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.short}</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-snug line-clamp-5">{p.systemPrompt}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
