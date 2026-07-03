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

// -------- Sync All: pull crawl + branding + PWA readiness into the app --------
const CATEGORY_HINTS: Array<[string, RegExp]> = [
  ["Productivity", /\b(task|todo|note|productivity|workflow|calendar)\b/i],
  ["Business", /\b(crm|invoice|sales|business|enterprise|b2b)\b/i],
  ["Finance", /\b(finance|invest|bank|budget|crypto|payment)\b/i],
  ["Health & Fitness", /\b(fitness|health|workout|nutrition|meditation)\b/i],
  ["Education", /\b(learn|course|tutor|education|study)\b/i],
  ["Entertainment", /\b(movie|music|stream|entertainment|video|podcast)\b/i],
  ["Games", /\b(game|play|puzzle|arcade)\b/i],
  ["Social", /\b(chat|social|community|friend|message)\b/i],
];
const guessCategory = (text: string) => CATEGORY_HINTS.find(([, r]) => r.test(text))?.[0] ?? "Utility";
const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const okHead = async (url: string) => {
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow" });
    return r.ok;
  } catch { return false; }
};

export const syncAppFromCrawl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: app, error: appErr } = await context.supabase.from("apps").select("*").eq("id", data.id).maybeSingle();
    if (appErr) throw appErr;
    if (!app) throw new Error("App not found");
    if (!app.base_url) return { ok: false as const, error: "No base URL set — add one before syncing." };

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Firecrawl not configured" };
    const { default: Firecrawl } = await import("@mendable/firecrawl-js");
    const fc = new Firecrawl({ apiKey });

    const base = app.base_url.replace(/\/$/, "");
    const origin = (() => { try { return new URL(base).origin; } catch { return base; } })();

    const warnings: string[] = [];
    const [scrapeRes, mapRes, manifestOk, swOk, appleIconOk, icon192Ok, icon512Ok] = await Promise.all([
      fc.scrape(base, { formats: ["markdown", "links", "screenshot", "branding" as any, "summary" as any], onlyMainContent: false }).catch((e) => { warnings.push(`scrape: ${e.message}`); return null; }),
      fc.map(base, { limit: 50 }).catch((e) => { warnings.push(`map: ${e.message}`); return null; }),
      okHead(`${origin}/manifest.webmanifest`).then((a) => a || okHead(`${origin}/manifest.json`)),
      okHead(`${origin}/sw.js`).then((a) => a || okHead(`${origin}/service-worker.js`)),
      okHead(`${origin}/apple-touch-icon.png`),
      okHead(`${origin}/icon-192.png`).then((a) => a || okHead(`${origin}/icons/icon-192.png`)),
      okHead(`${origin}/icon-512.png`).then((a) => a || okHead(`${origin}/icons/icon-512.png`)),
    ]);

    const scrape: any = scrapeRes ?? {};
    const meta = scrape.metadata ?? scrape.data?.metadata ?? {};
    const branding: any = scrape.branding ?? scrape.data?.branding ?? {};
    const summary: string = scrape.summary ?? scrape.data?.summary ?? "";
    const markdown: string = scrape.markdown ?? scrape.data?.markdown ?? "";
    const linksArr: string[] = (mapRes as any)?.links?.map?.((l: any) => (typeof l === "string" ? l : l?.url)).filter(Boolean) ?? [];

    const title = meta.title || meta.ogTitle;
    const description = meta.description || meta.ogDescription || summary;
    const themeColor = branding?.colors?.primary || branding?.colors?.accent || meta.themeColor;
    const bgColor = branding?.colors?.background;
    const logo = branding?.logo || branding?.images?.logo || meta.ogImage;
    const privacyUrl = linksArr.find((l) => /privacy/i.test(l));
    const supportUrl = linksArr.find((l) => /support|contact|help/i.test(l));

    const patch: Record<string, unknown> = {};
    if (!app.short_desc && description) patch.short_desc = clamp(description, 80);
    if (!app.long_desc && (summary || markdown)) patch.long_desc = clamp(summary || markdown, 3800);
    if (!app.theme_color && themeColor) patch.theme_color = themeColor;
    if (!app.bg_color && bgColor) patch.bg_color = bgColor;
    if (!app.icon_url && logo) patch.icon_url = logo;
    if ((!app.category || app.category === "Other") && (summary || markdown)) patch.category = guessCategory(summary + " " + markdown);
    if (app.name === app.slug && title) patch.name = title;

    if (Object.keys(patch).length) {
      const { error } = await context.supabase.from("apps").update(patch).eq("id", app.id);
      if (error) warnings.push(`apps update: ${error.message}`);
    }

    // PWA checklist upsert
    const isHttps = base.startsWith("https://");
    const pwaChecklist = {
      manifest: manifestOk, icon192: icon192Ok, icon512: icon512Ok, apple_touch: appleIconOk,
      service_worker: swOk, https: isHttps, responsive: true,
    };
    const pwaAllOk = Object.values(pwaChecklist).every(Boolean);
    const stores: Array<{ store: "pwa" | "apple" | "google"; checklist: any; status: string }> = [
      { store: "pwa", checklist: pwaChecklist, status: pwaAllOk ? "ready" : "in_progress" },
      { store: "apple", checklist: { privacy_url: !!privacyUrl, support_url: !!supportUrl, description: !!description }, status: "in_progress" },
      { store: "google", checklist: { privacy_url: !!privacyUrl, short_desc: !!description, full_desc: !!(summary || markdown) }, status: "in_progress" },
    ];
    for (const s of stores) {
      const { error } = await context.supabase.from("app_store_submissions").upsert(
        { app_id: app.id, user_id: context.userId, store: s.store, checklist: s.checklist as any, status: s.status },
        { onConflict: "app_id,store" },
      );
      if (error) warnings.push(`${s.store} upsert: ${error.message}`);
    }

    // Seed default data tables if none
    const { data: existingTables } = await context.supabase.from("app_tables").select("id").eq("app_id", app.id).limit(1);
    if (!existingTables || existingTables.length === 0) {
      await context.supabase.from("app_tables").insert([
        { app_id: app.id, user_id: context.userId, name: "Feedback", schema: [{ name: "name", type: "text" }, { name: "email", type: "text" }, { name: "message", type: "text" }] as any },
        { app_id: app.id, user_id: context.userId, name: "Contacts", schema: [{ name: "name", type: "text" }, { name: "email", type: "text" }] as any },
      ]);
    }

    // Latest QA run for this URL (optional)
    let latestQa: any = null;
    try {
      const { data: qa } = await context.supabase.from("qa_runs").select("*").ilike("start_url", `${base}%`).order("created_at", { ascending: false }).limit(1);
      latestQa = qa?.[0] ?? null;
    } catch { /* qa_runs may not have start_url column */ }

    return {
      ok: true as const,
      filled: { ...patch, pwa: pwaChecklist, privacyUrl, supportUrl, linksFound: linksArr.length, qaRun: latestQa?.id ?? null },
      warnings,
    };
  });
