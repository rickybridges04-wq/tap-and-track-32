import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/forms/$appId/$formName")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: app } = await supabaseAdmin.from("apps").select("id").eq("id", params.appId).maybeSingle();
          if (!app) return new Response(JSON.stringify({ error: "app not found" }), { status: 404, headers: { "content-type": "application/json" } });
          const { error } = await supabaseAdmin.from("app_form_submissions").insert({
            app_id: params.appId,
            form_name: params.formName.slice(0, 60),
            payload: body,
          });
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "content-type": "application/json" } });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      }),
    },
  },
});
