"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth";

async function admin() {
  const me = await requireMember();
  if (me.role !== "admin") throw new Error("admin only");
  return { me, supabase: await createClient() };
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function setParam(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  const key = String(formData.get("key"));
  const type = String(formData.get("type"));
  const raw = String(formData.get("value") ?? "");
  const value = type === "number" ? Number(raw) : type === "boolean" ? raw === "true" : raw;
  const { error } = await supabase.rpc("set_scenario_param", { p_scenario: scenarioId, p_key: key, p_value: value });
  fail(error);
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function setAllParams(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("param:")) continue;
    const [, key, type] = name.split(":");
    const value = type === "number" ? Number(raw) : type === "boolean" ? raw === "true" : String(raw);
    const { error } = await supabase.rpc("set_scenario_param", { p_scenario: scenarioId, p_key: key, p_value: value });
    fail(error);
  }
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function overrideLine(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  const { error } = await supabase.rpc("override_scenario_line", {
    p_line: String(formData.get("line_id")),
    p_quantity: Number(formData.get("quantity")),
    p_unit_cost: Number(formData.get("unit_cost")),
  });
  fail(error);
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function resetLine(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  const { error } = await supabase.rpc("reset_scenario_line", { p_line: String(formData.get("line_id")) });
  fail(error);
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function addManualLine(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  const { error } = await supabase.from("scenario_line_items").insert({
    scenario_id: scenarioId,
    department_id: String(formData.get("department_id")),
    name_he: String(formData.get("name_he")),
    quantity: Number(formData.get("quantity") || 1),
    unit_cost: Number(formData.get("unit_cost") || 0),
    is_override: true,
  });
  fail(error);
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function addIncome(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  const dept = String(formData.get("department_id") || "");
  const { error } = await supabase.from("scenario_income_lines").insert({
    scenario_id: scenarioId,
    fund_kind: String(formData.get("fund_kind")),
    department_id: dept || null,
    name_he: String(formData.get("name_he")),
    amount: Number(formData.get("amount") || 0),
  });
  fail(error);
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function deleteIncome(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  const { error } = await supabase.from("scenario_income_lines").delete().eq("id", String(formData.get("id")));
  fail(error);
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function cloneScenario(formData: FormData) {
  const { supabase } = await admin();
  const { data, error } = await supabase.rpc("clone_scenario", {
    p_source: String(formData.get("scenario_id")),
    p_name: String(formData.get("name") || "עותק"),
  });
  fail(error);
  revalidatePath("/scenarios");
  redirect(`/scenarios/${data}`);
}

export async function newScenario(formData: FormData) {
  const { supabase } = await admin();
  const { data, error } = await supabase.rpc("new_scenario", {
    p_event: String(formData.get("event_id")),
    p_name: String(formData.get("name") || "תרחיש חדש"),
  });
  fail(error);
  revalidatePath("/scenarios");
  redirect(`/scenarios/${data}`);
}

export async function approveScenario(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  const { error } = await supabase.rpc("approve_scenario_checked", { p_scenario: scenarioId });
  fail(error);
  revalidatePath("/scenarios");
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function renameScenario(formData: FormData) {
  const { supabase } = await admin();
  const scenarioId = String(formData.get("scenario_id"));
  const { error } = await supabase.from("scenarios").update({ name: String(formData.get("name")) }).eq("id", scenarioId);
  fail(error);
  revalidatePath(`/scenarios/${scenarioId}`);
}

export async function deleteScenario(formData: FormData) {
  const { supabase } = await admin();
  const { error } = await supabase.from("scenarios").delete().eq("id", String(formData.get("scenario_id"))).neq("status", "approved");
  fail(error);
  revalidatePath("/scenarios");
  redirect("/scenarios");
}
