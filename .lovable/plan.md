

## Diagnosis

The search engines don't work due to **build errors** that prevent the app from compiling. There are two root causes:

1. **Certificacao.tsx** references a table `certificados_ocp` that doesn't exist in the database schema (only `leads` exists). It also uses a `Certificado` type with fields (`certificado`, `portaria`, `titular`, `validade`, `alerta_dias`) that don't match the `leads` table.

2. **Relatorios.tsx** passes `title` prop to `StatCard`, but the component expects `label` instead.

Additionally, the **CNAE external search** uses the BrasilAPI endpoint `/api/cnae/v2/` which returns 404 for codes with slashes/dashes (edge function logs confirm repeated 404s). The Prospeccao page itself calls BrasilAPI directly (bypassing the edge function), which is correct, but uses `/api/cnae/v2/` — the correct endpoint format needs the raw numeric code.

## Plan

### Step 1 — Fix Certificacao.tsx build errors
Rewrite the page to remove all references to the non-existent `certificados_ocp` table. Replace with a placeholder that queries the `leads` table filtered by OCP categories, or display a "coming soon" state until a proper certificates table is created.

### Step 2 — Fix Relatorios.tsx StatCard props
Change all `title=` props to `label=` to match the `StatCardProps` interface. Also remove `trend` prop which doesn't exist on the component.

### Step 3 — Fix CNAE search URL
In `Prospeccao.tsx`, the CNAE query uses `/api/cnae/v2/{code}` — BrasilAPI's CNAE v2 endpoint requires clean numeric codes without dashes. Verify the codes being sent are clean 7-digit numbers.

### Technical Details

**Certificacao.tsx changes:**
- Remove `supabase.from("certificados_ocp")` calls (3 locations)
- Replace with a simple UI showing OCP leads from the `leads` table filtered by `portaria_145_2022` and `portaria_384_2020` categories
- Remove the `Certificado` interface and mutation logic

**Relatorios.tsx changes (line 66-69):**
- `title=` → `label=`
- Remove `trend="positive"` prop

**Prospeccao.tsx CNAE fix:**
- Strip non-numeric chars from CNAE code before calling BrasilAPI
- Use `/api/cnae/v2/{clean_code}` with just digits

