import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// SRC CAPITAL REPLACEMENT PRICING SCHEDULE (fallback constants)
// ============================================================
const REPLACEMENT_PRICING = {
  prologis_texas: {
    recover_tpo: 6.0,
    recover_bur_gravel: 6.25,
    tearoff_two_new_tpo: 10.0,
    tearoff_two_fully_adhered: 12.0,
    tpo_infill_over_metal: 8.25,
    spud_torch_2ply_over_bur: 9.0,
    epdm_membrane_swap: 6.0,
    adder_fully_adhered_over_steel: 2.0,
    adder_loadmasters: 3.0,
  },
  non_prologis_texas: {
    recover_tpo_bur_smooth_modbit: 5.75,
    recover_bur_gravel: 6.5,
    tpo_infill_over_metal: 7.5,
    tearoff_two_new_tpo: 10.0,
    epdm_membrane_swap: 6.0,
    eastgroup_hou_recover: 6.5,
    eastgroup_hou_tearoff: 9.0,
  },
  non_prologis_general: {
    recover_tpo_bur_smooth_modbit: 5.25,
    recover_bur_gravel: 5.5,
    tpo_infill_over_metal: 7.0,
    tearoff_two_roofs: 10.25,
    epdm_membrane_swap: 4.75,
    spud_torch_2ply_over_bur: 9.0,
    adder_loadmasters: 3.0,
    adder_fully_adhered: 2.0,
  },
} as const;

// ============================================================
// SRC REPAIR / DEFICIENCY PRICING SCHEDULE (fallback constants)
// ============================================================
const REPAIR_PRICING: Record<string, { unit: string; price: number; notes: string }[]> = {
  tpo_single_ply: [
    { unit: "ea", price: 138, notes: "fill pitch pan" },
    { unit: "ea", price: 350, notes: "reflash scupper" },
    { unit: "ea", price: 1800, notes: "reflash 6x5 curb" },
    { unit: "ea", price: 165, notes: "small patch" },
    { unit: "lf", price: 35, notes: "reflash expansion joint" },
    { unit: "lf", price: 30, notes: "new edge metal" },
    { unit: "ea", price: 210, notes: "flash pipe or AC stand" },
  ],
  epdm: [
    { unit: "ea", price: 138, notes: "fill pitch pan" },
    { unit: "ea", price: 165, notes: "seal hole or tear" },
    { unit: "lf", price: 33, notes: "reflash walls or curbs" },
    { unit: "ea", price: 77, notes: "reseal expansion joint seams" },
    { unit: "lf", price: 22, notes: "clean and reseal open seam" },
  ],
  bur_gravel: [
    { unit: "ea", price: 2065, notes: "flash 6x5 curb" },
    { unit: "ea", price: 275, notes: "flash pipe or AC stand with permaflash" },
    { unit: "ea", price: 88, notes: "fill pitch pan" },
    { unit: "ea", price: 100, notes: "seal open base flashing under 5 items" },
    { unit: "ea", price: 50, notes: "seal open base flashing 5 plus items" },
    { unit: "lf", price: 40, notes: "encapsulate expansion joint over 100 lf" },
    { unit: "lf", price: 70, notes: "encapsulate expansion joint under 100 lf" },
    { unit: "lf", price: 55, notes: "new gravel stop" },
    { unit: "ea", price: 55, notes: "clean and reseal storm collars on pipes" },
  ],
  bur_cap_sheet_modbit: [
    { unit: "lf", price: 33, notes: "seal expansion bellows" },
    { unit: "lf", price: 55, notes: "new gravel stop" },
    { unit: "ea", price: 88, notes: "fill pitch pan" },
    { unit: "lf", price: 40, notes: "seal base flashing over 100 lf" },
    { unit: "lf", price: 70, notes: "seal base flashing under 100 lf" },
    { unit: "lf", price: 73, notes: "replace wall flashing" },
    { unit: "ea", price: 150, notes: "patch blister" },
    { unit: "ea", price: 550, notes: "reflash scupper" },
    { unit: "ea", price: 3300, notes: "new drain" },
    { unit: "ea", price: 95, notes: "fill pitch pan cap sheet" },
  ],
  sheet_metal: [
    { unit: "lf", price: 60, notes: "replace gutter over 50 lf" },
    { unit: "lf", price: 80, notes: "replace gutter under 50 lf" },
    { unit: "lf", price: 33, notes: "seal coping joints" },
    { unit: "lf", price: 77, notes: "replace coping cap" },
    { unit: "lf", price: 8, notes: "clean and caulk counterflashing" },
    { unit: "lf", price: 10, notes: "new counterflashing" },
    { unit: "lf", price: 28, notes: "replace counterflashing" },
    { unit: "ea", price: 850, notes: "clean gutter half day" },
    { unit: "ea", price: 1700, notes: "clean gutter full day" },
    { unit: "ea", price: 110, notes: "seal laps" },
    { unit: "lf", price: 17, notes: "clean prime and paint rusted areas of gutter" },
    { unit: "ea", price: 55, notes: "replace downspout" },
  ],
  skylights: [
    { unit: "ea", price: 1045, notes: "replace 4x4 dome" },
    { unit: "ea", price: 2035, notes: "replace 4x8 dome" },
    { unit: "ea", price: 4500, notes: "replace 4x8 melt out" },
    { unit: "ea", price: 5500, notes: "replace 4x8 spring loaded" },
    { unit: "ea", price: 165, notes: "reseal skylight" },
    { unit: "ea", price: 1000, notes: "new safety fall protection" },
    { unit: "ea", price: 800, notes: "new walk pads" },
  ],
  misc: [
    { unit: "ea", price: 165, notes: "HVAC service door" },
    { unit: "ea", price: 55, notes: "reseal storm collars" },
    { unit: "ea", price: 195, notes: "seal tilt wall joint" },
    { unit: "ea", price: 550, notes: "replace drain strainer" },
    { unit: "ea", price: 550, notes: "remove trash" },
    { unit: "ea", price: 25, notes: "seal conduit" },
    { unit: "ea", price: 14000, notes: "exterior wall ladder min" },
    { unit: "ea", price: 22000, notes: "exterior wall ladder max" },
  ],
};

// ============================================================
// DEFAULT PROHIBITED PHRASES
// ============================================================
const DEFAULT_PROHIBITED_PHRASES = [
  "structurally sound", "no structural concerns", "guaranteed", "warranted",
  "will not leak", "no further action required", "fully compliant",
  "covered by insurance", "insurance will pay", "meets all code requirements", "code compliant",
];

// ============================================================
// Types
// ============================================================
interface ExtractedReport {
  property_address?: string | null;
  client_name?: string | null;
  market?: string | null;
  roof_system_type?: string | null;
  system_description?: string | null;
  square_footage?: number | null;
  roof_age?: number | null;
  installed_year?: number | null;
  roof_rating?: string | null;
  replacement_year?: number | null;
  capital_expense_total?: number | null;
  capital_expense_per_sqft?: number | null;
  capital_expense_type?: string | null;
  capital_expense_year?: number | null;
  maintenance_budget_total?: number | null;
  maintenance_budget_per_sqft?: number | null;
  executive_summary?: string | null;
  scope_of_work?: string | null;
  work_order_history_summary?: string | null;
  inspection_findings?: string | null;
  deficiencies?: Array<{
    number: number;
    category: string;
    description: string;
    quantity?: number;
    cost?: number;
  }>;
  deficiency_budget_total?: number | null;
  deficiency_budget_per_sqft?: number | null;
  sections_present?: string[];
  line_items?: Array<Record<string, any>>;
  recommendations?: Array<Record<string, any>>;
  [key: string]: any;
}

interface ProofFlag {
  flag_type: string;
  severity: "warning" | "error";
  pass: number;
  description: string;
  expected: string;
  found: string;
  confidence?: number;
}

// ============================================================
// Pass 1 — Capital Expense Budget Validation
// ============================================================
function runPass1CapitalExpense(data: ExtractedReport): ProofFlag[] {
  const flags: ProofFlag[] = [];
  const roofArea = data.square_footage;
  const capitalTotal = data.capital_expense_total;
  if (!roofArea || !capitalTotal) return flags;

  const isPrologis = /prologis/i.test(data.client_name ?? "");
  const isTexas = /dallas|houston|austin|san antonio|fort worth|tx/i.test(data.market ?? "");
  const desc = data.system_description ?? data.roof_system_type ?? "";
  const capType = data.capital_expense_type ?? "";

  const isRecover = /recover/i.test(capType);
  const isTearoffTwo = /tear.?off.{0,10}two|tearoff.{0,10}2/i.test(capType);
  const isBURGravel = /bur.{0,10}gravel|gravel.{0,10}bur/i.test(desc);
  const isTPO = /tpo/i.test(desc);
  const isEPDM = /epdm/i.test(desc);
  const isFullyAdhered = /fully.adhered/i.test(capType);
  const isLoadmasters = /loadmaster/i.test(capType);
  const isInfillMetal = /infill.{0,10}metal|metal.{0,10}infill/i.test(capType);

  let basePricePerSqft: number | null = null;

  if (isPrologis && isTexas) {
    const pt = REPLACEMENT_PRICING.prologis_texas;
    if (isRecover && isBURGravel) basePricePerSqft = pt.recover_bur_gravel;
    else if (isRecover) basePricePerSqft = pt.recover_tpo;
    else if (isTearoffTwo && isFullyAdhered) basePricePerSqft = pt.tearoff_two_fully_adhered;
    else if (isTearoffTwo) basePricePerSqft = pt.tearoff_two_new_tpo;
    else if (isInfillMetal) basePricePerSqft = pt.tpo_infill_over_metal;
    else if (isEPDM) basePricePerSqft = pt.epdm_membrane_swap;
    if (basePricePerSqft && isFullyAdhered && !isTearoffTwo) basePricePerSqft += pt.adder_fully_adhered_over_steel;
    if (basePricePerSqft && isLoadmasters) basePricePerSqft += pt.adder_loadmasters;
  } else if (!isPrologis && isTexas) {
    const npt = REPLACEMENT_PRICING.non_prologis_texas;
    if (isRecover && isBURGravel) basePricePerSqft = npt.recover_bur_gravel;
    else if (isRecover) basePricePerSqft = npt.recover_tpo_bur_smooth_modbit;
    else if (isTearoffTwo) basePricePerSqft = npt.tearoff_two_new_tpo;
    else if (isInfillMetal) basePricePerSqft = npt.tpo_infill_over_metal;
    else if (isEPDM) basePricePerSqft = npt.epdm_membrane_swap;
  } else {
    const npg = REPLACEMENT_PRICING.non_prologis_general;
    if (isRecover && isBURGravel) basePricePerSqft = npg.recover_bur_gravel;
    else if (isRecover) basePricePerSqft = npg.recover_tpo_bur_smooth_modbit;
    else if (isTearoffTwo) basePricePerSqft = npg.tearoff_two_roofs;
    else if (isInfillMetal) basePricePerSqft = npg.tpo_infill_over_metal;
    else if (isEPDM) basePricePerSqft = npg.epdm_membrane_swap;
    if (basePricePerSqft && isLoadmasters) basePricePerSqft += npg.adder_loadmasters;
    if (basePricePerSqft && isFullyAdhered) basePricePerSqft += npg.adder_fully_adhered;
  }

  if (basePricePerSqft === null) {
    flags.push({
      flag_type: "capital_expense", severity: "warning", pass: 1,
      description: "Could not match capital expense type to a known pricing category. Manual review required.",
      expected: "Recognized replacement type (recover, tear-off, infill, EPDM swap)",
      found: capType || "unknown",
    });
    return flags;
  }

  // Economies of scale adjustment
  let economiesAdj = 0;
  if (roofArea < 100000) {
    economiesAdj = ((100000 - roofArea) / 25000) * 1.0;
  } else if (roofArea >= 200000) {
    economiesAdj = -1.0;
  }

  const adjustedPriceLow = basePricePerSqft + economiesAdj - 0.25;
  const adjustedPriceHigh = basePricePerSqft + economiesAdj + 0.25;
  const expectedTotalLow = Math.round(adjustedPriceLow * roofArea);
  const expectedTotalHigh = Math.round(adjustedPriceHigh * roofArea);

  const statedPerSqft = data.capital_expense_per_sqft ?? (capitalTotal / roofArea);
  const midpoint = basePricePerSqft + economiesAdj;
  const percentOff = Math.abs(statedPerSqft - midpoint) / midpoint;

  if (percentOff > 0.10) {
    flags.push({
      flag_type: "capital_expense",
      severity: percentOff > 0.20 ? "error" : "warning",
      pass: 1,
      description: `Capital expense per sqft appears outside expected range for ${isPrologis ? "Prologis" : "non-Prologis"} ${isTexas ? "Texas" : "general"} market. Base: $${basePricePerSqft.toFixed(2)}/sqft, economies adj: +$${economiesAdj.toFixed(2)}/sqft (roof area: ${roofArea.toLocaleString()} sqft).`,
      expected: `$${adjustedPriceLow.toFixed(2)}–$${adjustedPriceHigh.toFixed(2)}/sqft (total ~$${expectedTotalLow.toLocaleString()}–$${expectedTotalHigh.toLocaleString()})`,
      found: `$${statedPerSqft.toFixed(2)}/sqft (total $${capitalTotal.toLocaleString()})`,
    });
  }

  return flags;
}

// ============================================================
// Pass 2 — Deficiency Pricing Validation
// ============================================================
function runPass2DeficiencyPricing(data: ExtractedReport): ProofFlag[] {
  const flags: ProofFlag[] = [];
  const { deficiencies } = data;
  if (!deficiencies?.length) return flags;

  const desc = data.system_description ?? data.roof_system_type ?? "";
  const isBURGravel = /bur.{0,10}gravel|gravel.{0,10}bur/i.test(desc);
  const isTPO = /tpo/i.test(desc);
  const isEPDM = /epdm/i.test(desc);
  const isCapSheet = /cap.?sheet|mod.?bit/i.test(desc);

  for (const def of deficiencies) {
    const { number: defNum, category, description, quantity, cost } = def;
    if (!quantity || !cost) continue;

    let pricingSections: typeof REPAIR_PRICING[string][] = [];
    if (/skylight/i.test(category)) pricingSections = [REPAIR_PRICING.skylights];
    else if (/gutter|downspout/i.test(category)) pricingSections = [REPAIR_PRICING.sheet_metal];
    else if (/perimeter|coping|edge/i.test(category)) pricingSections = [REPAIR_PRICING.sheet_metal];
    else if (/roof.top.equip|hvac|mechanical/i.test(category)) pricingSections = [REPAIR_PRICING.misc, REPAIR_PRICING.bur_gravel];
    else {
      if (isBURGravel) pricingSections = [REPAIR_PRICING.bur_gravel, REPAIR_PRICING.misc];
      else if (isTPO) pricingSections = [REPAIR_PRICING.tpo_single_ply, REPAIR_PRICING.misc];
      else if (isEPDM) pricingSections = [REPAIR_PRICING.epdm, REPAIR_PRICING.misc];
      else if (isCapSheet) pricingSections = [REPAIR_PRICING.bur_cap_sheet_modbit, REPAIR_PRICING.misc];
      else pricingSections = [REPAIR_PRICING.misc];
    }

    // Fuzzy match
    const descWords = (description || "").toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);
    let bestMatch: { price: number; notes: string; unit: string } | null = null;
    let bestScore = 0;

    for (const section of pricingSections) {
      for (const entry of section) {
        const noteWords = entry.notes.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);
        const overlap = descWords.filter((w: string) => noteWords.includes(w)).length;
        const score = noteWords.length > 0 ? overlap / noteWords.length : 0;
        if (score > bestScore) { bestScore = score; bestMatch = entry; }
      }
    }

    if (bestMatch && bestScore >= 0.3) {
      let quantityFactor = 1.0;
      if (quantity > 10) quantityFactor = 0.80;
      else if (quantity > 5) quantityFactor = 0.90;

      const expectedCost = Math.round(bestMatch.price * quantity * quantityFactor);
      const percentOff = Math.abs(cost - expectedCost) / expectedCost;

      if (percentOff > 0.20) {
        flags.push({
          flag_type: "deficiency_pricing",
          severity: percentOff > 0.40 ? "error" : "warning",
          pass: 2,
          description: `Deficiency ${defNum} (${category}): "${description}" — cost outside expected range. Best match: "${bestMatch.notes}" at $${bestMatch.price}/${bestMatch.unit}.`,
          expected: `~$${expectedCost.toLocaleString()} (${quantity} × $${bestMatch.price} × ${quantityFactor} factor)`,
          found: `$${cost.toLocaleString()}`,
        });
      }
    }
  }

  // Sum check
  const deficiencySum = deficiencies.reduce((acc, d) => acc + (d.cost ?? 0), 0);
  const statedTotal = data.deficiency_budget_total;
  if (statedTotal && Math.abs(deficiencySum - statedTotal) > 1) {
    flags.push({
      flag_type: "deficiency_pricing", severity: "error", pass: 2,
      description: "Sum of individual deficiency costs does not match stated total maintenance budget.",
      expected: `$${deficiencySum.toLocaleString()} (sum of line items)`,
      found: `$${statedTotal.toLocaleString()} (stated total)`,
    });
  }

  return flags;
}

// ============================================================
// Pass 3 — Math Validation (deterministic, no AI)
// ============================================================
function runPass3Math(data: ExtractedReport): ProofFlag[] {
  const flags: ProofFlag[] = [];
  const CURRENT_YEAR = new Date().getFullYear();
  const roofArea = data.square_footage;

  // Check 1: capital per_sqft × area ≈ total (±$500)
  if (data.capital_expense_per_sqft && roofArea && data.capital_expense_total) {
    const computed = data.capital_expense_per_sqft * roofArea;
    if (Math.abs(computed - data.capital_expense_total) > 500) {
      flags.push({
        flag_type: "math_error", severity: "error", pass: 3,
        description: "Capital expense per sqft × roof area does not equal capital expense total.",
        expected: `$${Math.round(computed).toLocaleString()} (${data.capital_expense_per_sqft}/sqft × ${roofArea.toLocaleString()} sqft)`,
        found: `$${data.capital_expense_total.toLocaleString()}`,
      });
    }
  }

  // Check 2: maintenance per_sqft × area ≈ total (±$100)
  if (data.maintenance_budget_per_sqft && roofArea && data.maintenance_budget_total) {
    const computed = data.maintenance_budget_per_sqft * roofArea;
    if (Math.abs(computed - data.maintenance_budget_total) > 100) {
      flags.push({
        flag_type: "math_error", severity: "error", pass: 3,
        description: "Maintenance budget per sqft × roof area does not equal maintenance budget total.",
        expected: `$${Math.round(computed).toLocaleString()}`,
        found: `$${data.maintenance_budget_total.toLocaleString()}`,
      });
    }
  }

  // Check 3: Sum of deficiency line items = stated total
  if (data.deficiencies?.length && data.deficiency_budget_total) {
    const sum = data.deficiencies.reduce((acc, d) => acc + (d.cost ?? 0), 0);
    if (Math.abs(sum - data.deficiency_budget_total) > 1) {
      flags.push({
        flag_type: "math_error", severity: "error", pass: 3,
        description: "Sum of deficiency costs does not match stated total maintenance budget on page 3.",
        expected: `$${sum.toLocaleString()}`,
        found: `$${data.deficiency_budget_total.toLocaleString()}`,
      });
    }
  }

  // Check 4: roof_age = current_year - installed_year (±1)
  if (data.roof_age && data.installed_year) {
    const expectedAge = CURRENT_YEAR - data.installed_year;
    if (Math.abs(data.roof_age - expectedAge) > 1) {
      flags.push({
        flag_type: "math_error", severity: "warning", pass: 3,
        description: "Roof age does not match current year minus install year.",
        expected: `${expectedAge} years (${CURRENT_YEAR} − ${data.installed_year})`,
        found: `${data.roof_age} years`,
      });
    }
  }

  // Check 5: replacement_year in the future
  if (data.replacement_year && data.replacement_year < CURRENT_YEAR) {
    flags.push({
      flag_type: "math_error", severity: "warning", pass: 3,
      description: "Capital expense replacement year is in the past.",
      expected: `Year >= ${CURRENT_YEAR}`,
      found: `${data.replacement_year}`,
    });
  }

  return flags;
}

// ============================================================
// Pass 4 — Inspection Findings Consistency (AI - Haiku)
// ============================================================
async function runPass4FindingsConsistency(
  data: ExtractedReport,
  anthropicKey: string
): Promise<ProofFlag[]> {
  if (!data.inspection_findings) return [];

  const prompt = `You are a QA proofer for SRC (Southern Roof Consultants) inspection reports.
Your job is to identify factual inconsistencies between different sections of the same report.
Be concise. Only flag genuine inconsistencies — do not flag things that are merely unspecified.

## Structured Report Data
\`\`\`json
${JSON.stringify({
    roof_system: data.roof_system_type,
    system_description: data.system_description,
    roof_rating: data.roof_rating,
    roof_age: data.roof_age,
    installed_year: data.installed_year,
    replacement_year: data.replacement_year,
    capital_expense_type: data.capital_expense_type,
    capital_expense_year: data.capital_expense_year,
    work_order_history_summary: data.work_order_history_summary,
    deficiency_count: data.deficiencies?.length,
    deficiency_categories: data.deficiencies?.map((d) => d.category),
  }, null, 2)}
\`\`\`

## Inspection Findings Narrative
${data.inspection_findings}

## Checks:
1. Does the findings narrative mention the correct roof system? Flag mismatches with structured data.
2. Is the capital expense type consistent with the roof system?
3. Does the roof rating make sense given age, deficiency count, and replacement year?
4. If work order history says "NO LEAKS REPORTED" but deficiencies include water-related repairs, flag it.
5. Any other factual inconsistency between sections.

Return ONLY a JSON array of objects: [{"description": string, "expected": string, "found": string, "severity": "warning"|"error"}]
Return [] if no issues.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) return [];
    const result = await resp.json();
    const text = result.content?.find((b: any) => b.type === "text")?.text ?? "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: Array<{ description: string; expected: string; found: string; severity: string }> = JSON.parse(jsonMatch[0]);
    return parsed.map((f) => ({
      flag_type: "findings_consistency" as const,
      severity: (f.severity === "error" ? "error" : "warning") as "error" | "warning",
      pass: 4,
      description: f.description,
      expected: f.expected,
      found: f.found,
    }));
  } catch (err) {
    console.error("Pass 4 error:", err);
    return [];
  }
}

// ============================================================
// Pass 5 — Photo Validation (AI Vision)
// ============================================================
async function runPass5PhotoValidation(
  data: ExtractedReport,
  pdfBase64: string,
  anthropicKey: string
): Promise<ProofFlag[]> {
  if (!pdfBase64) return [];

  const deficiencyContext = data.deficiencies
    ?.map((d) => `Deficiency ${d.number} (${d.category}): ${d.description}, quantity: ${d.quantity}`)
    .join("\n") ?? "No deficiency data extracted.";

  const prompt = `You are a QA proofer for SRC (Southern Roof Consultants) inspection reports.
You are viewing the photo pages (pages 4–8) of an inspection report.

## Expected deficiencies from report text:
${deficiencyContext}

## Roof system from Page 1:
${data.system_description ?? data.roof_system_type ?? "unknown"}

## Photo validation checks:
1. What roof system type is visible in the overview photos? Does it match "${data.system_description ?? data.roof_system_type}"?
   - Gravel surface → BUR gravel ✓ | White membrane → TPO ✓ | Black membrane → EPDM ✓
2. For each labeled deficiency photo, does it show the stated category?
3. Do deficiency photo counts reasonably match quantities in the deficiency list?
4. Are there obvious roof problems visible that are NOT mentioned in any deficiency? (flag at confidence 0.6–0.7 only)

Return ONLY a JSON array: [{"description": string, "expected": string, "found": string, "severity": "warning"|"error", "confidence": number}]
Only include flags with confidence >= 0.6. Return [] if no issues.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!resp.ok) return [];
    const result = await resp.json();
    const text = result.content?.find((b: any) => b.type === "text")?.text ?? "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: Array<{ description: string; expected: string; found: string; severity: string; confidence: number }> =
      JSON.parse(jsonMatch[0]);

    return parsed
      .filter((f) => (f.confidence ?? 1.0) >= 0.6)
      .map((f) => ({
        flag_type: "photo_validation" as const,
        severity: (f.severity === "error" ? "error" : "warning") as "error" | "warning",
        pass: 5,
        description: f.description,
        expected: f.expected,
        found: f.found,
        confidence: f.confidence,
      }));
  } catch (err) {
    console.error("Pass 5 error:", err);
    return [];
  }
}

// ============================================================
// Pass 6 — Prohibited Language
// ============================================================
function runPass6ProhibitedLanguage(data: ExtractedReport): ProofFlag[] {
  const flags: ProofFlag[] = [];
  const textFields = [
    { key: "executive_summary", label: "Executive Summary" },
    { key: "scope_of_work", label: "Scope of Work" },
    { key: "inspection_findings", label: "Inspection Findings" },
  ];

  for (const field of textFields) {
    const text = data[field.key];
    if (!text || typeof text !== "string") continue;
    const textLower = text.toLowerCase();

    for (const phrase of DEFAULT_PROHIBITED_PHRASES) {
      if (textLower.includes(phrase)) {
        flags.push({
          flag_type: "prohibited_language",
          severity: "error",
          pass: 6,
          description: `"${phrase}" found in ${field.label}. This is prohibited language per SRC guidelines.`,
          expected: "No prohibited language",
          found: phrase,
        });
      }
    }
  }

  return flags;
}

// ============================================================
// Main Edge Function
// ============================================================
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(supabaseUrl, serviceRoleKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reportId } = await req.json();
    if (!reportId) {
      return new Response(JSON.stringify({ error: "reportId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch report
    const { data: report, error: fetchErr } = await sb
      .from("reports").select("*").eq("id", reportId).single();
    if (fetchErr || !report) {
      return new Response(JSON.stringify({ error: "Report not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (report.status !== "extracted") {
      return new Response(
        JSON.stringify({ error: `Report status is '${report.status}', expected 'extracted'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await sb.from("reports").update({ status: "proofing" }).eq("id", reportId);

    const extracted: ExtractedReport = report.extracted_data ?? {};

    // Fetch PDF for Pass 5 (photo validation)
    let pdfBase64: string | null = null;
    if (report.original_storage_path) {
      const { data: fileData } = await sb.storage
        .from("report-uploads")
        .download(report.original_storage_path);
      if (fileData) {
        const buffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        pdfBase64 = btoa(binary);
      }
    }

    // Run all 6 passes
    const allFlags: ProofFlag[] = [
      ...runPass1CapitalExpense(extracted),
      ...runPass2DeficiencyPricing(extracted),
      ...runPass3Math(extracted),
      ...(anthropicKey ? await runPass4FindingsConsistency(extracted, anthropicKey) : []),
      ...(anthropicKey && pdfBase64 ? await runPass5PhotoValidation(extracted, pdfBase64, anthropicKey) : []),
      ...runPass6ProhibitedLanguage(extracted),
    ];

    // Insert flags into DB
    if (allFlags.length > 0) {
      const flagRows = allFlags.map((f) => ({
        report_id: reportId,
        field_address: `pass_${f.pass}`,
        field_label: f.description.slice(0, 100),
        flag_type: f.flag_type,
        current_value: f.found,
        suggested_value: f.expected,
        reason: f.description,
        confidence: f.confidence ?? null,
        severity: f.severity,
        pass_number: f.pass,
      }));

      const { error: insertErr } = await sb.from("flags").insert(flagRows);
      if (insertErr) {
        await sb.from("reports").update({ status: "failed", error_message: `Flag insert failed: ${insertErr.message}` }).eq("id", reportId);
        return new Response(
          JSON.stringify({ error: "Failed to insert flags", details: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Update report
    await sb.from("reports").update({ status: "proofed", flag_count: allFlags.length }).eq("id", reportId);

    // Audit log
    const flagsByType: Record<string, number> = {};
    for (const f of allFlags) flagsByType[f.flag_type] = (flagsByType[f.flag_type] || 0) + 1;

    await sb.from("audit_log").insert({
      report_id: reportId,
      user_id: user.id,
      action: "proof",
      details: { flag_count: allFlags.length, flags_by_type: flagsByType },
    });

    return new Response(
      JSON.stringify({ success: true, flagCount: allFlags.length, flagsByType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    try {
      const sb = createClient(supabaseUrl, serviceRoleKey);
      const body = await req.clone().json().catch(() => null);
      if (body?.reportId) {
        await sb.from("reports").update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Unknown proofing error",
        }).eq("id", body.reportId);
      }
    } catch { /* best effort */ }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
