import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for DB operations
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // Verify the user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reportId } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({ error: "reportId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Update status to extracting
    await sb.from("reports").update({ status: "extracting" }).eq("id", reportId);

    // Download PDF from storage
    const { data: fileData, error: dlErr } = await sb.storage
      .from("report-uploads")
      .download(report.original_storage_path);

    if (dlErr || !fileData) {
      await sb.from("reports").update({ status: "failed", error_message: "Failed to download PDF" }).eq("id", reportId);
      return new Response(JSON.stringify({ error: "Failed to download PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const pdfBase64 = btoa(binary);

    // Call Claude API with PDF as document + tool_use for structured extraction
    const extractionTool = {
      name: "extract_report_data",
      description: "Extract structured data from an SRC inspection report PDF",
      input_schema: {
        type: "object",
        properties: {
          property_address: { type: ["string", "null"], description: "Full property street address" },
          building_identifier: { type: ["string", "null"], description: "Building name or number" },
          inspection_date: { type: ["string", "null"], description: "Date of inspection in YYYY-MM-DD format" },
          weather_conditions: { type: ["string", "null"], description: "Weather conditions at time of inspection" },
          inspector_name: { type: ["string", "null"], description: "Name of the inspector" },
          inspector_credentials: { type: ["string", "null"], description: "Inspector certifications or credentials" },
          service_type: {
            type: ["string", "null"],
            enum: ["annual_pm", "due_diligence", "survey", "storm", "construction_management", null],
            description: "Type of inspection service performed",
          },
          roof_system_type: { type: ["string", "null"], description: "Type of roof system (e.g., TPO, EPDM, BUR)" },
          system_description: { type: ["string", "null"], description: "Full roof system description (e.g., 'BUR with Gravel Surface')" },
          square_footage: { type: ["number", "null"], description: "Roof area in square feet" },
          roof_age: { type: ["number", "null"], description: "Roof age in years as a number" },
          installed_year: { type: ["number", "null"], description: "Year the roof was installed (e.g. 2004)" },
          roof_rating: { type: ["string", "null"], description: "Roof condition rating (e.g. Serviceable, Good, Needs Replacement)" },
          replacement_year: { type: ["number", "null"], description: "Projected replacement year (e.g. 2027)" },
          client_name: { type: ["string", "null"], description: "Client or owner name (e.g. Link Logistics, Prologis)" },
          market: { type: ["string", "null"], description: "Market or city (e.g. Dallas, Houston)" },
          capital_expense_total: { type: ["number", "null"], description: "Total capital expense budget in dollars" },
          capital_expense_per_sqft: { type: ["number", "null"], description: "Capital expense per square foot" },
          capital_expense_type: { type: ["string", "null"], description: "Capital expense description (e.g. Roof Replacement (Recover))" },
          capital_expense_year: { type: ["number", "null"], description: "Year for capital expense (e.g. 2027)" },
          maintenance_budget_total: { type: ["number", "null"], description: "Total maintenance/deficiency budget in dollars" },
          maintenance_budget_per_sqft: { type: ["number", "null"], description: "Maintenance budget per square foot" },
          executive_summary: { type: ["string", "null"], description: "Full executive summary text" },
          scope_of_work: { type: ["string", "null"], description: "Scope of work narrative" },
          work_order_history_summary: { type: ["string", "null"], description: "Full text of work order history section" },
          inspection_findings: { type: ["string", "null"], description: "Full text of inspection findings paragraph" },
          sections_present: {
            type: "array",
            items: { type: "string" },
            description: "List of all section headers/titles found in the report",
          },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                unit: { type: "string" },
                quantity: { type: "number" },
                unit_cost: { type: "number" },
                total_cost: { type: "number" },
              },
              required: ["description"],
            },
            description: "All line items with pricing",
          },
          deficiencies: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "number", description: "Deficiency number (e.g. 1, 2, 3)" },
                category: { type: "string", description: "Category (e.g. Roof Top Equipment, Skylights)" },
                description: { type: "string", description: "Full description text" },
                quantity: { type: "number", description: "Quantity from parenthetical notation like (3)" },
                cost: { type: "number", description: "Dollar amount for this deficiency" },
              },
              required: ["number", "category", "description"],
            },
            description: "Structured deficiency items from deficiency schedule (page 3). Parse quantity from parenthetical notation like '(3)' as a number.",
          },
          deficiency_budget_total: { type: ["number", "null"], description: "Stated total deficiency/maintenance budget at bottom of deficiency page" },
          deficiency_budget_per_sqft: { type: ["number", "null"], description: "Deficiency budget per square foot" },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                priority: { type: "string", enum: ["high", "medium", "low"] },
                description: { type: "string" },
              },
              required: ["priority", "description"],
            },
            description: "Recommendations with priority levels",
          },
          confidence: {
            type: "number",
            description: "Overall confidence in extraction accuracy from 0.0 to 1.0",
          },
        },
        required: ["sections_present", "line_items", "deficiencies", "recommendations", "confidence"],
      },
    };

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 8192,
        tools: [extractionTool],
        tool_choice: { type: "tool", name: "extract_report_data" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              {
                type: "text",
                text: "Extract all structured data from this SRC commercial roofing inspection report PDF. Be thorough — capture every field, line item, deficiency, recommendation, and section header.\n\nKey instructions:\n- For line items, extract description, unit, quantity, unit_cost, and total_cost.\n- For deficiencies (typically on page 3), extract each as a structured object with number, category, description, quantity, and cost. Parse the quantity from parenthetical notation like '(3)' as a number.\n- Extract the client name, market/city, roof rating, installed year, replacement year, capital expense details, and maintenance budget.\n- Extract the full text of work_order_history_summary and inspection_findings paragraphs.\n- If a field is not present in the document, return null for that field.\n- Return your confidence as a number from 0.0 to 1.0.",
              },
            ],
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error("Claude API error:", errText);
      await sb.from("reports").update({
        status: "failed",
        error_message: `Claude API error: ${claudeResponse.status}`,
      }).eq("id", reportId);
      return new Response(
        JSON.stringify({ error: "Extraction failed", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeData = await claudeResponse.json();

    // Parse the tool use response
    const toolUseBlock = claudeData.content?.find(
      (block: { type: string }) => block.type === "tool_use"
    );

    if (!toolUseBlock?.input) {
      await sb.from("reports").update({
        status: "failed",
        error_message: "No structured data returned from extraction",
      }).eq("id", reportId);
      return new Response(
        JSON.stringify({ error: "No structured data in response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extractedData = toolUseBlock.input;
    const confidence = extractedData.confidence ?? 0;

    // Save to database
    await sb.from("reports").update({
      extracted_data: extractedData,
      corrected_data: extractedData,
      extraction_confidence: confidence,
      status: "extracted",
    }).eq("id", reportId);

    // Audit log
    await sb.from("audit_log").insert({
      report_id: reportId,
      user_id: user.id,
      action: "extract",
      details: {
        confidence,
        sections_found: extractedData.sections_present?.length ?? 0,
        line_items_found: extractedData.line_items?.length ?? 0,
        recommendations_found: extractedData.recommendations?.length ?? 0,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        extractedData,
        confidence,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("extract-report error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
