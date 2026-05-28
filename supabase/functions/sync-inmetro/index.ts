// Edge function: sync-inmetro
// Integração real com INMETRO Prodcert filtrando ESTRITAMENTE por Organismo Certificador = 'SCITEC'.
// NENHUM dado mock/demo é inserido em hipótese alguma. Se a fonte oficial falhar ou retornar vazio,
// respondemos 200 com fallback=true e inserted=0 — o front-end mostra apenas o que já existe no banco.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface ProdcertRow {
  numero_certificado: string;
  cnpj_empresa: string | null;
  razao_social: string | null;
  portaria: string | null;
  data_validade: string; // yyyy-mm-dd
  organismo: string;
  acred?: string | null;
}

// Placeholder para integração oficial. Hoje retorna [] — nunca devolve mock.
// Quando a integração com Prodcert for plugada, esta função deve retornar SOMENTE
// registros vindos da fonte oficial. O filtro 'SCITEC' abaixo continua obrigatório.
async function fetchProdcertScitec(): Promise<ProdcertRow[]> {
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let raw: ProdcertRow[] = [];
    try {
      raw = await fetchProdcertScitec();
    } catch (e) {
      console.error("prodcert fetch failed", e);
      return new Response(
        JSON.stringify({
          success: true,
          fallback: true,
          message: "Fonte INMETRO indisponível no momento — mantendo dados locais.",
          scraped: 0, discarded: 0, inserted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // FILTRO ESTRITO: somente Organismo Certificador === 'SCITEC'
    const scitecOnly = raw.filter(
      (r) => (r.organismo || "").trim().toUpperCase() === "SCITEC"
    );
    const discarded = raw.length - scitecOnly.length;

    if (!scitecOnly.length) {
      return new Response(
        JSON.stringify({
          success: true,
          fallback: true,
          message: raw.length
            ? `Nenhum certificado SCITEC encontrado (${discarded} descartado(s) de outros OCPs).`
            : "Nenhum certificado retornado pela fonte oficial — nenhum dado inserido.",
          scraped: raw.length, discarded, inserted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const rows = scitecOnly.map((r) => ({
      numero_certificado: r.numero_certificado,
      cnpj_empresa: r.cnpj_empresa,
      razao_social: r.razao_social,
      portaria: r.portaria,
      data_validade: r.data_validade,
      numero_acreditacao: r.acred ?? null,
      organismo_certificador: "SCITEC",
      titular: "Scitec Inspeções e Certificações",
      status_registro: "ativo",
    }));

    const { data, error } = await supabase
      .from("certificados")
      .upsert(rows, { onConflict: "numero_certificado", ignoreDuplicates: false })
      .select("id");

    if (error) {
      console.error("upsert error", error);
      return new Response(
        JSON.stringify({
          success: false, fallback: true,
          message: `Falha ao gravar no banco: ${error.message}`,
          scraped: raw.length, discarded, inserted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Varredura SCITEC concluída — ${rows.length} certificado(s) sincronizado(s) (${discarded} descartado(s)).`,
        scraped: raw.length, discarded, inserted: data?.length ?? rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("sync-inmetro fatal", err);
    return new Response(
      JSON.stringify({
        success: false, fallback: true,
        message: err?.message || "Erro inesperado na varredura SCITEC",
        scraped: 0, discarded: 0, inserted: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
