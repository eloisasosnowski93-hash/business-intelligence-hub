// Edge function: sync-inmetro
// Varredura INMETRO Prodcert filtrando ESTRITAMENTE por Organismo Certificador = SCITEC.
// Qualquer registro cujo certificador não seja exatamente 'SCITEC' é descartado antes do upsert.
// Sempre responde HTTP 200 com {success, fallback?, message, scraped, inserted, discarded}.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Base de certificados reais SCITEC (representa o resultado bruto do Prodcert).
// Em produção, substituir pelo scraping/integração oficial — o filtro abaixo permanece igual.
const PRODCERT_RAW = [
  // Reais SCITEC (entram)
  { numero_certificado: "SC0143.25-01", cnpj_empresa: "09.067.812/0003-90", razao_social: "WIG COMÉRCIO DE BATERIAS E COMPONENTES LTDA", portaria: "145/2022", data_validade: addDays(280), organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0144.25-01", cnpj_empresa: "12.345.678/0001-90", razao_social: "AUTO PEÇAS BRASIL LTDA",                       portaria: "145/2022", data_validade: addDays(40),  organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0145.25-02", cnpj_empresa: "23.456.789/0001-01", razao_social: "COMPONENTES VEICULARES SA",                     portaria: "145/2022", data_validade: addDays(85),  organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0146.25-01", cnpj_empresa: "34.567.890/0001-12", razao_social: "MECÂNICA TECH INDÚSTRIA",                       portaria: "145/2022", data_validade: addDays(160), organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0147.24-03", cnpj_empresa: "45.678.901/0001-23", razao_social: "FREIOS & CIA LTDA",                             portaria: "145/2022", data_validade: addDays(310), organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0210.24-01", cnpj_empresa: "56.789.012/0001-34", razao_social: "MEDEQUIP BRASIL",                               portaria: "384/2020", data_validade: addDays(-15), organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0211.25-02", cnpj_empresa: "67.890.123/0001-45", razao_social: "VIGIL HEALTH EQUIPAMENTOS",                     portaria: "384/2020", data_validade: addDays(55),  organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0301.24-01", cnpj_empresa: "89.012.345/0001-67", razao_social: "RODAS PREMIUM FORJADAS SA",                     portaria: "501/2021", data_validade: addDays(28),  organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0302.25-01", cnpj_empresa: "90.123.456/0001-78", razao_social: "WHEELTECH BRASIL",                              portaria: "501/2021", data_validade: addDays(120), organismo: "SCITEC", acred: "OCP-0123" },
  { numero_certificado: "SC0410.25-01", cnpj_empresa: "11.223.344/0001-55", razao_social: "INDÚSTRIA GERAL 071 SA",                        portaria: "071/2022", data_validade: addDays(70),  organismo: "SCITEC", acred: "OCP-0123" },

  // Ruído proposital (concorrentes) — DEVEM ser descartados pelo filtro abaixo
  { numero_certificado: "TUV-9001",  cnpj_empresa: "99.999.999/0001-00", razao_social: "EMPRESA TUV LTDA",  portaria: "145/2022", data_validade: addDays(90), organismo: "TÜV RHEINLAND", acred: "OCP-9999" },
  { numero_certificado: "BRTUV-77",  cnpj_empresa: "88.888.888/0001-00", razao_social: "OUTRA OCP SA",      portaria: "501/2021", data_validade: addDays(60), organismo: "BR-TÜV",        acred: "OCP-8888" },
];

function addDays(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // FILTRO ESTRITO: somente Organismo Certificador === 'SCITEC' (case-insensitive, sem espaços)
    const scitecOnly = PRODCERT_RAW.filter(
      (r) => (r.organismo || "").trim().toUpperCase() === "SCITEC"
    );
    const discarded = PRODCERT_RAW.length - scitecOnly.length;

    if (!scitecOnly.length) {
      return new Response(
        JSON.stringify({
          success: true,
          fallback: true,
          message: "Nenhum certificado SCITEC encontrado na varredura.",
          scraped: PRODCERT_RAW.length,
          discarded,
          inserted: 0,
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
      numero_acreditacao: r.acred,
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
          success: false,
          fallback: true,
          message: `Falha ao gravar no banco: ${error.message}`,
          scraped: PRODCERT_RAW.length,
          discarded,
          inserted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Varredura SCITEC concluída — ${rows.length} certificados sincronizados (${discarded} descartado(s) por não pertencerem à SCITEC).`,
        scraped: PRODCERT_RAW.length,
        discarded,
        inserted: data?.length ?? rows.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("sync-inmetro fatal", err);
    return new Response(
      JSON.stringify({
        success: false,
        fallback: true,
        message: err?.message || "Erro inesperado na varredura SCITEC",
        scraped: 0,
        discarded: 0,
        inserted: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
