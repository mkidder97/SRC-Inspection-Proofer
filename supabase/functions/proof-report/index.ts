import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Required sections per service type
const REQUIRED_SECTIONS: Record<string, string[]> = {
  annual_pm: [
    "Property Overview",
    "Roof System Description",
    "Condition Assessment",
    "Maintenance Recommendations",
    "Photo Documentation",
  ],
  due_diligence: [
    "Property Overview",
    "Roof System Description",
    "Condition Assessment",
    "Estimated Remaining Life",
    "Capital Expenditure Projection",
    "Photo Documentation",
  ],
  survey: [
    "Property Overview",
    "Roof System Description",
    "Baseline Condition Assessment",
    "Deficiency Documentation",
    "Maintenance Recommendations",
    "Photo Documentation",
  ],
  storm: [
    "Property Overview",
    "Roof System Description",
    "Storm Event Summary",
    "Damage Assessment",
    "Insurance Documentation",
    "Photo Documentation",
  ],
  construction_management: [
    "Project Overview",
    "Contractor Information",
    "Materials Verification",
    "Progress Documentation",
    "Quality Control Findings",
    "Completion Status",
  ],
};

const DEFAULT_PROHIBITED_PHRASES = [
  "structurally sound",
  "no structural concerns",
  "guaranteed",
  "warranted",
  "will not leak",
  "no further action required",
  "fully compliant",
  "covered by insurance",
  "insurance will pay",
  "meets all code requirements",
  "code compliant",
];

interface FlagInput {
  report_id: string;
  field_address: string;
  field_label: string;
  flag_type: string;
  current_value: string | null;
  suggested_value: string | null;
  reason: string;
  confidence: number;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reportId } = await req.json();
    if (!reportId) {
      return new Response(
        JSON.stringify({ error: "reportId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch report
    const { data: report, error: fetchErr } = await sb
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchErr || !report) {
      return new Response(JSON.stringify({ error: "Report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (report.status !== "extracted") {
      return new Response(
        JSON.stringify({ error: `Report status is '${report.status}', expected 'extracted'` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Set proofing status
    await sb
      .from("reports")
      .update({ status: "proofing" })
      .eq("id", reportId);

    const extracted = report.extracted_data as Record<string, any>;
    const flags: FlagInput[] = [];

    // Load reference data
    const { data: refData } = await sb
      .from("reference_library")
      .select("*")
      .eq("is_active", true);

    const costEntries =
      refData?.filter((r: any) => r.entry_type === "cost_table") || [];
    const prohibitedEntries =
      refData?.filter((r: any) => r.entry_type === "prohibited_phrase") || [];
    const esRulesEntries =
      refData?.filter((r: any) => r.entry_type === "es_rules") || [];

    // ── Pass 1: Pricing Check ──
    const lineItems = extracted.line_items || [];
    const deficiencies = extracted.deficiencies || [];

    const pricingItems = [
      ...lineItems.map((item: any, i: number) => ({
        ...item,
        fieldPrefix: "line_items",
        index: i,
      })),
      ...deficiencies.map((item: any, i: number) => ({
        ...item,
        fieldPrefix: "deficiencies",
        index: i,
      })),
    ];

    for (const item of pricingItems) {
      const itemDesc = normalize(item.description || "");
      if (!itemDesc) continue;

      for (const costRef of costEntries) {
        const content = costRef.content as Record<string, any> | null;
        if (!content) continue;

        const refDesc = normalize(costRef.label || "");
        let confidence = 0;

        if (itemDesc === refDesc) {
          confidence = 1.0;
        } else if (itemDesc.includes(refDesc) || refDesc.includes(itemDesc)) {
          confidence = 0.75;
        }

        if (confidence === 0) continue;

        const minCost = content.min_cost ?? content.unit_cost;
        const maxCost = content.max_cost ?? content.unit_cost;
        const unit = content.unit || "unit";
        const itemCost =
          item.unit_cost ?? item.cost ?? item.total_cost ?? null;

        if (
          itemCost !== null &&
          minCost !== undefined &&
          maxCost !== undefined
        ) {
          if (itemCost < minCost * 0.95 || itemCost > maxCost * 1.05) {
            flags.push({
              report_id: reportId,
              field_address: `${item.fieldPrefix}[${item.index}].unit_cost`,
              field_label: item.description,
              flag_type: "pricing",
              current_value: `$${Number(itemCost).toFixed(2)}`,
              suggested_value: `$${Number(minCost).toFixed(2)} - $${Number(maxCost).toFixed(2)} per ${unit}`,
              reason: `Price does not match SRC cost table (expected $${Number(minCost).toFixed(2)} - $${Number(maxCost).toFixed(2)} per ${unit})`,
              confidence,
            });
          }
        }
        break; // Use first match
      }
    }

    // ── Pass 2: Required Sections Check ──
    const serviceType = extracted.service_type || report.service_type;
    const requiredSections = REQUIRED_SECTIONS[serviceType] || [];
    const presentSections = (extracted.sections_present || []).map(
      (s: string) => s.toLowerCase()
    );

    for (const required of requiredSections) {
      const found = presentSections.some(
        (present: string) =>
          present.includes(required.toLowerCase()) ||
          required.toLowerCase().includes(present)
      );
      if (!found) {
        flags.push({
          report_id: reportId,
          field_address: "sections_present",
          field_label: required,
          flag_type: "missing_section",
          current_value: null,
          suggested_value: `Add "${required}" section`,
          reason: `Required section "${required}" not found in report`,
          confidence: 1.0,
        });
      }
    }

    // ── Pass 3: Completeness Check ──
    const completenessFields: { key: string; label: string }[] = [
      { key: "property_address", label: "Property Address" },
      { key: "inspection_date", label: "Inspection Date" },
      { key: "inspector_name", label: "Inspector Name" },
    ];

    for (const field of completenessFields) {
      const val = extracted[field.key];
      if (val === null || val === undefined || val === "") {
        flags.push({
          report_id: reportId,
          field_address: field.key,
          field_label: field.label,
          flag_type: "completeness",
          current_value: null,
          suggested_value: null,
          reason: `${field.label} is missing from the report`,
          confidence: 1.0,
        });
      }
    }

    // ── Pass 4: Prohibited Language Check ──
    let prohibitedPhrases: { phrase: string; replacement?: string }[] = [];

    if (prohibitedEntries.length > 0) {
      prohibitedPhrases = prohibitedEntries.map((e: any) => ({
        phrase: (e.label || "").toLowerCase(),
        replacement: e.content?.replacement || null,
      }));
    } else {
      prohibitedPhrases = DEFAULT_PROHIBITED_PHRASES.map((p) => ({
        phrase: p,
      }));
    }

    const textFieldsToCheck: { key: string; label: string }[] = [
      { key: "executive_summary", label: "Executive Summary" },
      { key: "scope_of_work", label: "Scope of Work" },
      { key: "inspection_findings", label: "Inspection Findings" },
    ];

    for (const field of textFieldsToCheck) {
      const text = extracted[field.key];
      if (!text || typeof text !== "string") continue;
      const textLower = text.toLowerCase();

      for (const { phrase, replacement } of prohibitedPhrases) {
        if (textLower.includes(phrase)) {
          flags.push({
            report_id: reportId,
            field_address: field.key,
            field_label: `Prohibited language in ${field.label}`,
            flag_type: "prohibited_language",
            current_value: phrase,
            suggested_value: replacement || null,
            reason: `"${phrase}" is prohibited language per SRC guidelines`,
            confidence: 1.0,
          });
        }
      }
    }

    // ── Pass 5: Executive Summary Consistency (AI) ──
    if (anthropicKey && extracted.executive_summary) {
      try {
        const esRulesText = esRulesEntries
          .filter(
            (r: any) => !r.service_type || r.service_type === serviceType
          )
          .map((r: any) =>
            typeof r.content === "string"
              ? r.content
              : JSON.stringify(r.content)
          )
          .join("\n\n");

        const prompt = `You are reviewing an SRC commercial roofing inspection report for consistency issues.

Service type: ${serviceType}
Executive Summary: ${extracted.executive_summary}
Recommendations: ${JSON.stringify(extracted.recommendations || [])}
${esRulesText ? `\nExecutive Summary Rules:\n${esRulesText}` : ""}

Check ONLY these three things:
1. Does the executive summary tone/content match the service type?
2. Are recommendations inconsistent with or unsupported by the summary?
3. Does the summary make liability or guarantee claims?

Return a JSON array of issues found. Each issue should be an object with:
- "description": string describing the issue
- "confidence": number 0.0-1.0

If no issues found, return an empty array [].
Return ONLY the JSON array, no other text.`;

        const claudeResponse = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-5",
              max_tokens: 2048,
              messages: [{ role: "user", content: prompt }],
            }),
          }
        );

        if (claudeResponse.ok) {
          const claudeData = await claudeResponse.json();
          const textBlock = claudeData.content?.find(
            (b: any) => b.type === "text"
          );
          if (textBlock?.text) {
            // Extract JSON array from response
            const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const issues = JSON.parse(jsonMatch[0]);
              for (const issue of issues) {
                if (issue.confidence >= 0.7) {
                  flags.push({
                    report_id: reportId,
                    field_address: "executive_summary",
                    field_label: "Executive Summary Consistency",
                    flag_type: "executive_summary",
                    current_value: null,
                    suggested_value: null,
                    reason: issue.description,
                    confidence: issue.confidence,
                  });
                }
              }
            }
          }
        }
      } catch {
        // Non-fatal — skip ES consistency if AI call fails
      }
    }

    // ── Insert flags and update report ──
    if (flags.length > 0) {
      const { error: insertErr } = await sb.from("flags").insert(flags);
      if (insertErr) {
        await sb
          .from("reports")
          .update({ status: "failed", error_message: `Failed to insert flags: ${insertErr.message}` })
          .eq("id", reportId);
        return new Response(
          JSON.stringify({ error: "Failed to insert flags", details: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await sb
      .from("reports")
      .update({ status: "proofed", flag_count: flags.length })
      .eq("id", reportId);

    // Audit log
    const flagsByType: Record<string, number> = {};
    for (const f of flags) {
      flagsByType[f.flag_type] = (flagsByType[f.flag_type] || 0) + 1;
    }

    await sb.from("audit_log").insert({
      report_id: reportId,
      user_id: user.id,
      action: "proof",
      details: { flag_count: flags.length, flags_by_type: flagsByType },
    });

    return new Response(
      JSON.stringify({
        success: true,
        flagCount: flags.length,
        flagsByType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    // Try to reset status on failure
    try {
      const sb = createClient(supabaseUrl, serviceRoleKey);
      const body = await req.clone().json().catch(() => null);
      if (body?.reportId) {
        await sb
          .from("reports")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown proofing error",
          })
          .eq("id", body.reportId);
      }
    } catch {
      // Best-effort cleanup
    }

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
