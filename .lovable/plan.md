
## Diagnosis

The build is broken because `Certificacao.tsx` still references `certificados_ocp` (a table that doesn't exist). The DB only has `leads`. To implement the requested 90-day alert logic, cross-referencing, and INMETRO sync, I need a real `certificados` table.

## Plan

### 1. Database — new `certificados` table
Create `public.certificados` with: `id`, `numero_certificado`, `cnpj_empresa`, `razao_social`, `data_validade` (date), `status_registro`, `portaria`, `titular`, `numero_acreditacao`, `created_at`, `updated_at`. RLS: public read; insert/update via edge function (service role).

### 2. Sidebar reorganization (`AppSidebar.tsx`)
- **Lab**: Dashboard, Prospecção, Relatórios, Configurações.
- **OCP**: Dashboard, Prospecção, Relatórios, Configurações + **Certificação**.
Remove CRM/Endotoxina/Enriquecimento/Motor de Busca from both menus (keep route files for now, just hide from nav).

### 3. Rewrite `Certificacao.tsx` (OCP only)
- Query `certificados` table.
- 90-day alert: highlight row (red bg) + bell icon when `data_validade - today ≤ 90`.
- Top counter: "X certificados próximos do vencimento" (≤90d, including expired).
- Cadastro manual form + "Sincronizar INMETRO" button → calls new edge function.
- Filter chips by portaria.

### 4. Edge function `sync-inmetro`
Fetches Scitec certificates from INMETRO Prodcert (best-effort scrape with fallback message if blocked). Upserts into `certificados`. Filtered by "SCITEC" name / acreditação number.

### 5. Update `Prospeccao.tsx` (OCP cross-reference)
- After CNPJ search results, check each CNPJ against `certificados.cnpj_empresa`.
- Mark matched leads with badge "Cliente Ativo".
- Toggle: "Ocultar leads já certificados pela Scitec".
- Add filters: CNAE, UF, Data de Abertura (open-date range).
- Result columns: Razão Social, Nome Fantasia, Telefone, Situação Cadastral.
- Use BrasilAPI/CNPJ.ws via existing `search-cnpj` edge function (extend to accept UF + open-date filters).

### 6. Update OCP Dashboard
- Add alert card: "X certificados vencem em ≤90 dias" → clickable, navigates to `/certificacao?filter=criticos`.
- Keep existing bento layout.

### 7. Files
- New: `supabase/migrations/<ts>_certificados.sql`, `supabase/functions/sync-inmetro/index.ts`
- Edit: `src/components/AppSidebar.tsx`, `src/pages/Certificacao.tsx`, `src/pages/Prospeccao.tsx`, `src/pages/Dashboard.tsx`, `supabase/functions/search-cnpj/index.ts`, `src/integrations/supabase/types.ts` (auto)

### Notes / caveats
- INMETRO Prodcert has no public API; the sync function will attempt scraping with proper UA — if blocked, returns a clear message and the user keeps the manual cadastro flow as fallback.
- CNPJ.ws free tier is rate-limited (3 req/min); `search-cnpj` already uses BrasilAPI as primary — I'll keep BrasilAPI and add CNPJ.ws as enrichment fallback.
