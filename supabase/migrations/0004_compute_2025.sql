-- w0t5: compute + approve the 2025 reference scenario so v_scenario_summary shows 44,390 / 1,268.29
-- (the 2022 scenarios are hand-made override lines and need no compute)
select compute_scenario('00000000-0000-0000-0000-00000000a025');
select approve_scenario('00000000-0000-0000-0000-00000000a025');
