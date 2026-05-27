// Edge function: sync-inmetro
// Simula varredura no INMETRO Prodcert filtrando por Organismo Certificador/Titular = SCITEC
// e faz upsert na tabela `certificados`. Retorna sempre 200 com {success, fallback?, message, ...}
// para o front-end nunca quebrar por HTTP não-2xx.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Base simulada de certificados SCITEC (representa o que seria raspado do Prodcert).
// Em produção, substituir por scraping real / API oficial.
const SCITEC_SIMULATED = [
  { numero_certificado: "SCITEC-145-2024-001", cnpj_empresa: "12.345.678/0001-90", razao_social: "Auto Peças Brasil Ltda",          portaria: "145/2022", data_validade: addDays(40),  numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-145-2024-002", cnpj_empresa: "23.456.789/0001-01", razao_social: "Componentes Veiculares SA",        portaria: "145/2022", data_validade: addDays(85),  numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-145-2024-003", cnpj_empresa: "34.567.890/0001-12", razao_social: "MecânicaTech Indústria",           portaria: "145/2022", data_validade: addDays(160), numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-145-2024-004", cnpj_empresa: "45.678.901/0001-23", razao_social: "Freios & Cia Ltda",                portaria: "145/2022", data_validade: addDays(310), numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-384-2024-001", cnpj_empresa: "56.789.012/0001-34", razao_social: "MedEquip Brasil",                  portaria: "384/2020", data_validade: addDays(-15), numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-384-2024-002", cnpj_empresa: "67.890.123/0001-45", razao_social: "Vigil Health Equipamentos",        portaria: "384/2020", data_validade: addDays(55),  numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-384-2024-003", cnpj_empresa: "78.901.234/0001-56", razao_social: "Sanitec Indústria Hospitalar",     portaria: "384/2020", data_validade: addDays(220), numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-501-2024-001", cnpj_empresa: "89.012.345/0001-67", razao_social: "Rodas Premium Forjadas SA",        portaria: "501/2021", data_validade: addDays(28),  numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-501-2024-002", cnpj_empresa: "90.123.456/0001-78", razao_social: "WheelTech Brasil",                 portaria: "501/2021", data_validade: addDays(120), numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-501-2024-003", cnpj_empresa: "01.234.567/0001-89", razao_social: "Aluminox Rodas Ltda",              portaria: "501/2021", data_validade: addDays(400), numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-071-2024-001", cnpj_empresa: "11.223.344/0001-55", razao_social: "Indústria Geral 071 SA",           portaria: "071/2022", data_validade: addDays(70),  numero_acreditacao: "OCP-0123" },
  { numero_certificado: "SCITEC-071-2024-002", cnpj_empresa: "22.334.455/0001-66", razao_social: "Manufatura Conformidade Ltda",     portaria: "071/2022", data_validade: addDays(250), numero_acreditacao: "OCP-0123" },
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

    const rows = SCITEC_SIMULATED.map((r) => ({
      ...r,
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
          scraped: rows.length,
          inserted: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Varredura SCITEC concluída — ${rows.length} certificados sincronizados (Prodcert simulado).`,
        scraped: rows.length,
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
        inserted: 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
