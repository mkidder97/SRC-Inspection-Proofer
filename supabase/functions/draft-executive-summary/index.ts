import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const sb = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { reportId } = await req.json();
    if (!reportId) return new Response(JSON.stringify({ error: "reportId required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: report, error: fetchErr } = await sb.from("reports").select("*").eq("id", reportId).single();
    if (fetchErr || !report) return new Response(JSON.stringify({ error: "Report not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const data = (report.corrected_data || report.extracted_data || {}) as Record<string, any>;
    const ctx = (report.proofer_context || {}) as Record<string, any>;

    // Load prohibited phrases
    const { data: phrases } = await sb.from("reference_library").select("label").eq("entry_type", "prohibited_phrase").eq("is_active", true);
    const prohibitedList = phrases?.length
      ? phrases.map((p: any) => p.label).join(", ")
      : "structurally sound, no structural concerns, guaranteed, warranted, will not leak, fully compliant, covered by insurance";

    const deficiencyList = (data.deficiencies || [])
      .map((d: any) => `- Deficiency ${d.number} (${d.category}): ${d.description} — Qty: ${d.quantity ?? 'N/A'}, Cost: $${(d.cost || 0).toLocaleString()}`)
      .join("\n");

    const currentYear = new Date().getFullYear();
    const yearsUntil = data.replacement_year ? data.replacement_year - currentYear : null;

    const prompt = `You are a senior technical writer for SRC (Southern Roof Consultants). Draft an executive summary for an annual preventive maintenance inspection report.

## Report Data
Property: ${data.property_address || '[address]'}
Client: ${data.client_name || '[client]'}
Roof System: ${data.system_description || data.roof_system_type || '[system]'}
Square Footage: ${data.square_footage ? data.square_footage.toLocaleString() : '[sqft]'} sqft
Roof Age: ${data.roof_age || '[age]'} years (installed ${data.installed_year || '[year]'})
Roof Rating: ${data.roof_rating || '[rating]'}
Inspection Date: ${data.inspection_date || '[date]'}
Inspector: ${data.inspector_name || '[inspector]'}

Capital Expense: $${(data.capital_expense_total || 0).toLocaleString()} ($${data.capital_expense_per_sqft || '?'}/sqft)
Capital Expense Type: ${data.capital_expense_type || '[type]'}
Replacement Year: ${data.replacement_year || '[year]'}${yearsUntil !== null ? ` (${yearsUntil} years from now)` : ''}

Skylights: ${ctx.skylight_count || 0}
Leak History: ${ctx.has_leak_history ? 'Yes' : 'No known leaks'}
${ctx.special_notes ? `Special Notes: ${ctx.special_notes}` : ''}

## Deficiencies
${deficiencyList || 'None identified'}

## Structure (Annual PM — 4 paragraphs)
Paragraph 1: Property overview — address, roof system type, approximate area, age, and overall condition rating. If replacement is within 1-2 years, include: "Due to the age, current conditions, and leak history, SRC recommends replacing this assembly."
Paragraph 2: Inspection findings — summarize what was observed, mention key deficiency categories, reference specific high-dollar items (>=$500).
Paragraph 3: Capital expense — state the replacement budget, per-sqft rate, projected timeline. Mention skylight replacement costs if applicable.
Paragraph 4: Recommendations — prioritized action items, maintenance suggestions, timeline urgency.

## Rules
- Professional, factual, advisory tone
- Use exact numbers from the data (do not round or approximate)
- Reference deficiencies by category, not by number
- NEVER use these prohibited phrases: ${prohibitedList}
- No liability language, no guarantees, no insurance claims
- Keep each paragraph 2-4 sentences

Return ONLY the executive summary text — no headers, no markdown, no explanation. Just the 4 paragraphs separated by blank lines.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: "AI draft failed", details: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resp.json();
    const text = result.content?.find((b: any) => b.type === "text")?.text ?? "";

    // Convert paragraphs to HTML
    const htmlDraft = text.split(/\n\n+/).map((p: string) => `<p>${p.trim()}</p>`).join("")

    return new Response(JSON.stringify({ draft: htmlDraft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
