const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { systemPrompt, comando } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: comando },
        ],
        max_tokens: 16000,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("AI Gateway error:", res.status, errText);
      const msg =
        res.status === 429 ? "Limite de requisições atingido. Tente novamente em instantes."
        : res.status === 402 ? "Créditos de IA esgotados. Adicione créditos no workspace."
        : `Motor de IA indisponível (status ${res.status}). Tente novamente.`;
      // Sempre 200 para o front não quebrar com "non-2xx"
      return new Response(JSON.stringify({ text: "{}", error: msg, fallback: true, upstream_status: res.status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    return new Response(JSON.stringify({ text }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("hunt-leads-ocp error:", e);
    return new Response(JSON.stringify({ text: "{}", error: (e as Error).message || "Erro inesperado", fallback: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
