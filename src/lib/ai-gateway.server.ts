// Lovable AI Gateway provider helper (server-only).
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { baeSdkFetch } from "@/lib/bae-gateway.server";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1", fetch: baeSdkFetch,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}
