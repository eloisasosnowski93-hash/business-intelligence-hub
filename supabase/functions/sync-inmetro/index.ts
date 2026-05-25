import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // INMETRO Prodcert has no public API. Best-effort attempt to fetch the public listing.
    // If blocked, we return a clear message so the user falls back to manual cadastro.
    const inmetroUrl = "http://www.inmetro.gov.br/prodcert/";
    let scraped = 0;
    let inserted = 0;

    try {
      const res = await fetch(inmetroUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ScitecCertSync/1.0)",
          "Accept": "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `INMETRO retornou HTTP ${res.status}. Use o cadastro manual ou consulte o Prodcert diretamente.`,
            scraped: 0,
            inserted: 0,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      const html = await res.text();
      // Naive scrape: look for SCITEC mentions. Real Prodcert requires interactive search.
      const matches = html.match(/SCITEC[^<]*/gi) || [];
      scraped = matches.length;

    } catch (fetchErr) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "INMETRO Prodcert não responde a scraping automático (acesso bloqueado / requer navegação interativa). Use o cadastro manual nesta tela. Os dados consultados no site oficial podem ser inseridos diretamente.",
          scraped: 0,
          inserted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verificação concluída. INMETRO Prodcert exige consulta interativa — ${scraped} menções SCITEC detectadas no portal, mas sem dados estruturados extraíveis. Recomendado: use o cadastro manual com os dados oficiais consultados em http://www.inmetro.gov.br/prodcert/`,
        scraped,
        inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("sync-inmetro error", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
