import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "app";

export const listApps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("apps")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const getApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: app, error } = await context.supabase.from("apps").select("*").eq("id", data.id).maybeSingle();
    if (error) throw error;
    return app;
  });

export const createApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; base_url?: string; short_desc?: string; category?: string }) => {
    if (!d.name?.trim()) throw new Error("Name required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("apps")
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        slug: slugify(data.name),
        base_url: data.base_url ?? null,
        short_desc: data.short_desc ?? null,
        category: data.category ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("apps")
      .update(data.patch as any)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("apps").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Store submissions --------
export const getSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { appId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("app_store_submissions")
      .select("*")
      .eq("app_id", data.appId);
    if (error) throw error;
    return rows ?? [];
  });

export const upsertSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { appId: string; store: "pwa" | "apple" | "google"; checklist?: any; assets?: any; status?: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("app_store_submissions")
      .upsert(
        {
          app_id: data.appId,
          user_id: context.userId,
          store: data.store,
          checklist: data.checklist ?? {},
          assets: data.assets ?? {},
          status: data.status ?? "in_progress",
        },
        { onConflict: "app_id,store" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// -------- Form submissions inbox --------
export const listFormSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_form_submissions")
      .select("*, apps!inner(name,user_id)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const markSubmissionRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("app_form_submissions")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// -------- Push campaigns --------
export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notification_campaigns")
      .select("*, apps(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { app_id: string; title: string; body: string; image_url?: string; url?: string; scheduled_for?: string | null }) => {
    if (!d.title?.trim() || !d.body?.trim()) throw new Error("Title and body required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("notification_campaigns")
      .insert({
        app_id: data.app_id,
        user_id: context.userId,
        title: data.title,
        body: data.body,
        image_url: data.image_url ?? null,
        url: data.url ?? null,
        scheduled_for: data.scheduled_for ?? null,
        status: data.scheduled_for ? "scheduled" : "draft",
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const listSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { appId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("notification_subscribers")
      .select("*")
      .eq("app_id", data.appId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

// -------- Data manager --------
export const listAppTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_tables")
      .select("*, apps(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createAppTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { app_id: string; name: string; schema: { name: string; type: string }[] }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("app_tables")
      .insert({
        app_id: data.app_id,
        user_id: context.userId,
        name: data.name,
        schema: data.schema as any,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const listAppRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tableId: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("app_rows")
      .select("*")
      .eq("table_id", data.tableId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const insertAppRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table_id: string; data: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("app_rows")
      .insert({
        table_id: data.table_id,
        user_id: context.userId,
        data: data.data as any,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });
