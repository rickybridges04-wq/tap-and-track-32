import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjectTrends } from "@/lib/qa/projects.functions";

export function ProjectTrends({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["qa-project-trends", projectId],
    queryFn: () => getProjectTrends({ data: { id: projectId } }),
  });

  if (isLoading) {
    return <p className="mt-4 text-sm text-muted-foreground">Loading trends…</p>;
  }
  if (!data || (data.points.length === 0 && data.scores.length === 0)) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Trends appear once this project has completed runs.
      </p>
    );
  }

  const perf = data.points.map((p) => ({
    name: p.short_id,
    LCP: p.median_lcp_ms,
    TTFB: p.median_ttfb_ms,
  }));
  const axe = data.points.map((p) => ({
    name: p.short_id,
    critical: p.axe_critical,
    serious: p.axe_serious,
    moderate: p.axe_moderate,
    minor: p.axe_minor,
  }));
  const scores = data.scores.map((s) => ({
    name: `${s.kind === "automated" ? "A" : "C"} ${new Date(s.created_at).toLocaleDateString()}`,
    score: s.score,
  }));

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Median LCP and TTFB per automated run</CardTitle>
          <CardDescription>Measured in the browser worker, in milliseconds.</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={perf}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="LCP" stroke="hsl(var(--primary))" dot={false} />
              <Line type="monotone" dataKey="TTFB" stroke="hsl(var(--muted-foreground))" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Readiness score across all runs</CardTitle>
          <CardDescription>Crawl (C) and automated (A) runs.</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scores}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis domain={[0, 100]} fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" dot />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accessibility violations by impact</CardTitle>
          <CardDescription>Per automated run, from the browser's axe scan.</CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={axe}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="critical" stackId="a" fill="hsl(var(--destructive))" />
              <Bar dataKey="serious" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="moderate" stackId="a" fill="hsl(var(--muted-foreground))" />
              <Bar dataKey="minor" stackId="a" fill="hsl(var(--border))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Slowest cases</CardTitle>
          <CardDescription>Longest real browser durations across recent runs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {data.slowest.length === 0 && (
            <p className="text-muted-foreground">No timings recorded yet.</p>
          )}
          {data.slowest.map((s, i) => (
            <Link
              key={`${s.run_id}-${s.code}-${i}`}
              to="/qa/automated/$runId"
              params={{ runId: s.run_id }}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent/40"
            >
              <span className="font-mono text-xs">{s.code}</span>
              <span className="flex-1 truncate text-xs text-muted-foreground">{s.title}</span>
              <span className="text-xs font-medium">{s.duration_ms} ms</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
