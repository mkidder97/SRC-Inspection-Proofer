import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const { data: report, error: reportErr } = await sb
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (reportErr || !report) {
      return new Response(JSON.stringify({ error: "Report not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all flags
    const { data: flags, error: flagsErr } = await sb
      .from("flags")
      .select("*")
      .eq("report_id", reportId)
      .order("created_at");

    if (flagsErr) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch flags" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify all flags are resolved
    const openFlags = (flags || []).filter((f: any) => f.status === "open");
    if (openFlags.length > 0) {
      return new Response(
        JSON.stringify({
          error: `${openFlags.length} flag(s) still unresolved`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build corrections summary
    const extracted = report.extracted_data as Record<string, any> || {};
    const allFlags = flags || [];

    const accepted = allFlags.filter((f: any) => f.status === "accepted");
    const edited = allFlags.filter((f: any) => f.status === "edited");
    const dismissed = allFlags.filter((f: any) => f.status === "dismissed");

    const corrections = [...accepted, ...edited].map((f: any) => ({
      flag_type: f.flag_type,
      field_address: f.field_address,
      field_label: f.field_label,
      current_value: f.current_value,
      suggested_value: f.suggested_value,
      resolution_value: f.resolution_value,
      reason: f.reason,
      status: f.status,
    }));

    const dismissedList = dismissed.map((f: any) => ({
      flag_type: f.flag_type,
      field_label: f.field_label,
      reason: f.reason,
      dismiss_reason: f.dismiss_reason,
    }));

    const result = {
      metadata: {
        report_id: reportId,
        property_address: extracted.property_address || null,
        inspection_date: extracted.inspection_date || null,
        service_type: report.service_type,
        inspector_name: extracted.inspector_name || null,
        exported_at: new Date().toISOString(),
      },
      summary: {
        total: allFlags.length,
        accepted: accepted.length,
        edited: edited.length,
        dismissed: dismissed.length,
      },
      corrections,
      dismissed: dismissedList,
    };

    // Update report status
    await sb
      .from("reports")
      .update({ status: "completed" })
      .eq("id", reportId);

    // Audit log
    await sb.from("audit_log").insert({
      report_id: reportId,
      user_id: user.id,
      action: "export_corrections",
      details: result.summary,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
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
