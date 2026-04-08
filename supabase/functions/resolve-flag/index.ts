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

    const { flagId, action, finalValue, note } = await req.json();
    if (!flagId || !action) {
      return new Response(
        JSON.stringify({ error: "flagId and action are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!["accept", "edit", "dismiss"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be accept, edit, or dismiss" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch the flag
    const { data: flag, error: flagErr } = await sb
      .from("flags")
      .select("*")
      .eq("id", flagId)
      .single();

    if (flagErr || !flag) {
      return new Response(JSON.stringify({ error: "Flag not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map action to status
    const statusMap: Record<string, string> = {
      accept: "accepted",
      edit: "edited",
      dismiss: "dismissed",
    };

    // Update the flag
    const updateData: Record<string, any> = {
      status: statusMap[action],
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    };

    if (action === "accept") {
      updateData.resolution_value = finalValue ?? flag.suggested_value;
    } else if (action === "edit") {
      updateData.resolution_value = finalValue;
    } else if (action === "dismiss") {
      updateData.dismiss_reason = note || null;
    }

    const { error: updateErr } = await sb
      .from("flags")
      .update(updateData)
      .eq("id", flagId);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update flag", details: updateErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Count resolved flags for this report
    const { count: resolvedCount } = await sb
      .from("flags")
      .select("*", { count: "exact", head: true })
      .eq("report_id", flag.report_id)
      .neq("status", "open");

    const { count: totalCount } = await sb
      .from("flags")
      .select("*", { count: "exact", head: true })
      .eq("report_id", flag.report_id);

    // Update report resolved_count
    await sb
      .from("reports")
      .update({ resolved_count: resolvedCount || 0 })
      .eq("id", flag.report_id);

    const allResolved =
      totalCount !== null &&
      resolvedCount !== null &&
      resolvedCount >= totalCount;

    // Audit log
    await sb.from("audit_log").insert({
      report_id: flag.report_id,
      user_id: user.id,
      action: `flag_${action}`,
      details: {
        flag_id: flagId,
        flag_type: flag.flag_type,
        field_label: flag.field_label,
        resolution_value: updateData.resolution_value || null,
        dismiss_reason: updateData.dismiss_reason || null,
      },
    });

    return new Response(
      JSON.stringify({ success: true, allResolved }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
