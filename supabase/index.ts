/**
 * Edge Function: ocp-hunter
 * ──────────────────────────
 * Proxy seguro entre o front-end Lovable e a API da Anthropic.
 * Resolve o bloqueio de CORS: o navegador chama apenas o próprio
 * Supabase; a chave ANTHROPIC_API_KEY fica protegida no servidor.
 *
 * Deploy:
 *   supabase functions deploy ocp-hunter --no-verify-jwt
 *
 * Variável de ambiente (Supabase Dashboard → Settings → Edge Functions):
 *   ANTHROPIC_API_KEY = sk-ant-...
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ── CORS headers ─────────────────────────────────────────────────────────────
// Permite chamadas do domínio Lovable e localhost durante dev.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Pre-flight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente da Edge Function." }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Repassa o body inteiro para a API da Anthropic
    const body = await req.json();

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await anthropicRes.json();

    return new Response(JSON.stringify(data), {
      status: anthropicRes.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
