import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uid, upsertProject } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/projects/new")({
  head: () => ({ meta: [{ title: "New project · Bridges Tester" }] }),
  component: NewProject,
});

function NewProject() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) {
      toast.error("Name and base URL are required");
      return;
    }
    try {
      new URL(baseUrl);
    } catch {
      toast.error("Base URL must be a valid URL (https://...)");
      return;
    }
    const id = uid("proj");
    upsertProject({
      id,
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    });
    toast.success("Project added");
    navigate({ to: "/projects/$id", params: { id } });
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold tracking-tight">New project</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Point Bridges Tester at the public URL of your web app.
      </p>

      <Card className="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Project details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My SaaS" />
            </div>
            <div>
              <Label htmlFor="url">Base URL</Label>
              <Input id="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://app.example.com" />
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the tester should know — primary flows, areas to focus on." />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/" })}>Cancel</Button>
              <Button type="submit">Create project</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
