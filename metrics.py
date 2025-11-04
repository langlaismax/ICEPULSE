"""
            "HammerEff%":                   Hammer Efficiency
            "ForceEff%":                    Force Efficiency
            "StealEff%":                    Steal Efficiency
            "StealDef%":                    Steal Defense
            "PP_team_throws16_hammer":      Point per End with Hammer
            "PP_opp_throws16_hammer":       Point per End without Hammer
            "FromBehind%":                  Win from behind, minimum 3 point deficit.
            "Choke%":                       Lose from ahead, minimum 3 point lead
            "HammerFactor(pp)":             Hammer Factor (HammerEff% - StealDef%)
            "Record":                       Wins - Losses
            "Score":                        Points for - Points against
            "LSFE":                         Last stone first end wins - Last stone first end losses
            "NLSFE":                        No last stone first end wins - No last stone first end losses
            "StealsFor":                    Number of steal taken
            "ForPoints":                    Points Stolen
            "StealsAgainst":                Number of steals given 
            "AgainstPoints":                Points given up with hammer
            "Ends":                         Number of ends total
"""

def derive_team_metrics_from_games(games: pd.DataFrame) -> Dict[str, dict]:
    if games is None or games.empty:
        return {}

    M: Dict[str, dict] = {}

    def ensure(team: str) -> dict:
        key = str(team).strip()
        if key not in M:
            M[key] = {
                # per-end counters
                "ends_h": 0, "ends_nh": 0,
                "twoplus_h": 0,          # ≥2 with hammer
                "force_ok": 0,           # defending (no hammer) holds to 0 or 1
                "steal_for_ends": 0,     # no-hammer & scored ≥1
                "steal_def_bad": 0,      # WITH hammer & opponent scored (>0)

                # points & steals
                "pp_team_pts": 0, "pp_team_ends": 0,
                "pp_opp_pts": 0,  "pp_opp_ends": 0,
                "steals_for": 0, "for_points": 0,
                "steals_against": 0, "against_points": 0,

                # game-level
                "wins": 0, "losses": 0,
                "score_for": 0, "score_against": 0,

                # LSFE
                "lsfe_w": 0, "lsfe_l": 0, "nlsfe_w": 0, "nlsfe_l": 0,

                # comeback/choke
                "fb_attempts": 0, "fb_success": 0,
                "ch_attempts": 0, "ch_fail": 0,

                "ends_played": 0,
            }
        return M[key]

    def end_cols(df: pd.DataFrame):
        i = 1
        while True:
            a = f"TeamA_E{i}"; b = f"TeamB_E{i}"
            if a in df.columns and b in df.columns:
                yield a, b
                i += 1
            else:
                break

    for _, r in games.iterrows():
        A = str(r.get("TeamA", "")).strip()
        B = str(r.get("TeamB", "")).strip()
        if not A or not B:
            continue
        mA, mB = ensure(A), ensure(B)

        # Initial hammer (from Curling I/O flags; fallback to A if missing)
        a_first = bool(r.get("TeamA_FirstHammer", False))
        b_first = bool(r.get("TeamB_FirstHammer", False))
        hammer_is_A = (a_first and not b_first) or (not a_first and not b_first)

        scoreA = scoreB = 0
        A_behind3 = B_behind3 = False
        A_ahead3  = B_ahead3  = False
        ends_this = 0

        for a_col, b_col in end_cols(games):
            pa = 0 if pd.isna(r.get(a_col)) else int(r.get(a_col))
            pb = 0 if pd.isna(r.get(b_col)) else int(r.get(b_col))

            if hammer_is_A:
                # A has hammer this end
                mA["ends_h"] += 1
                mB["ends_nh"] += 1

                if pa >= 2:
                    mA["twoplus_h"] += 1

                # Steal defence: opponent scored while we had hammer
                if pb > 0:
                    mA["steal_def_bad"] += 1

                # Steal for (B without hammer)
                if pb > 0 and pa == 0:
                    mB["steal_for_ends"] += 1
                    mB["steals_for"]     += 1
                    mB["for_points"]     += pb
                    mA["steals_against"] += 1
                    mA["against_points"] += pb
                    mA["pp_opp_pts"]     += pb; mA["pp_opp_ends"] += 1

                # PP for A (hammer) when scoring with hammer
                if pa > 0 and pb == 0:
                    mA["pp_team_pts"] += pa; mA["pp_team_ends"] += 1

                # Force for B (without hammer): hold A to 0/1
                if pa <= 1:
                    mB["force_ok"] += 1

            else:
                # B has hammer this end
                mB["ends_h"] += 1
                mA["ends_nh"] += 1

                if pb >= 2:
                    mB["twoplus_h"] += 1

                if pa > 0:
                    mB["steal_def_bad"] += 1

                if pa > 0 and pb == 0:
                    mA["steal_for_ends"] += 1
                    mA["steals_for"]     += 1
                    mA["for_points"]     += pa
                    mB["steals_against"] += 1
                    mB["against_points"] += pa
                    mB["pp_opp_pts"]     += pa; mB["pp_opp_ends"] += 1

                if pb > 0 and pa == 0:
                    mB["pp_team_pts"] += pb; mB["pp_team_ends"] += 1

                if pb <= 1:
                    mA["force_ok"] += 1

            # Next-end hammer: blank keeps; score flips to non-scoring team
            if pa == 0 and pb == 0:
                pass  # retain
            elif pa > 0 and pb == 0:
                hammer_is_A = False
            elif pb > 0 and pa == 0:
                hammer_is_A = True
            # (both>0 shouldn't happen; ignore)

            # running score for comeback/choke tracking
            scoreA += pa; scoreB += pb; ends_this += 1
            diffA = scoreA - scoreB; diffB = -diffA
            if diffA <= -3: A_behind3 = True
            if diffB <= -3: B_behind3 = True
            if diffA >=  3: A_ahead3  = True
            if diffB >=  3: B_ahead3  = True

        # Finalize game outcome
        finalA = int(r.get("TeamA_Total") if pd.notna(r.get("TeamA_Total")) else scoreA)
        finalB = int(r.get("TeamB_Total") if pd.notna(r.get("TeamB_Total")) else scoreB)

        if finalA > finalB: mA["wins"] += 1; mB["losses"] += 1
        elif finalB > finalA: mB["wins"] += 1; mA["losses"] += 1

        mA["score_for"] += finalA; mA["score_against"] += finalB
        mB["score_for"] += finalB; mB["score_against"] += finalA

        # LSFE tallies from first_hammer flags
        if a_first and not b_first:
            if finalA > finalB: mA["lsfe_w"] += 1
            elif finalB > finalA: mA["lsfe_l"] += 1
            if finalB > finalA: mB["nlsfe_w"] += 1
            elif finalA > finalB: mB["nlsfe_l"] += 1
        elif b_first and not a_first:
            if finalB > finalA: mB["lsfe_w"] += 1
            elif finalA > finalB: mB["lsfe_l"] += 1
            if finalA > finalB: mA["nlsfe_w"] += 1
            elif finalB > finalA: mA["nlsfe_l"] += 1

        # Comeback / Choke
        if A_behind3: mA["fb_attempts"] += 1; mA["fb_success"] += int(finalA >= finalB)
        if B_behind3: mB["fb_attempts"] += 1; mB["fb_success"] += int(finalB >= finalA)
        if A_ahead3:  mA["ch_attempts"] += 1; mA["ch_fail"]   += int(finalA <= finalB)
        if B_ahead3:  mB["ch_attempts"] += 1; mB["ch_fail"]   += int(finalB <= finalA)

        mA["ends_played"] += ends_this
        mB["ends_played"] += ends_this

    # Finalize percentages
    for team, m in M.items():
        he = (100.0 * m["twoplus_h"]     / m["ends_h"])  if m["ends_h"]  else None
        fe = (100.0 * m["force_ok"]      / m["ends_nh"]) if m["ends_nh"] else None
        se = (100.0 * m["steal_for_ends"] / m["ends_nh"]) if m["ends_nh"] else None
        sd = (100.0 * m["steal_def_bad"]  / m["ends_h"])  if m["ends_h"]  else None

        M[team].update({
            "HammerEff%": he,
            "ForceEff%":  fe,
            "StealEff%":  se,
            "StealDef%":  sd,
            "PP_team_throws16_hammer": (m["pp_team_pts"] / m["pp_team_ends"]) if m["pp_team_ends"] else None,
            "PP_opp_throws16_hammer":  (m["pp_opp_pts"]  / m["pp_opp_ends"])  if m["pp_opp_ends"]  else None,
            "FromBehind%": (100.0 * m["fb_success"] / m["fb_attempts"]) if m["fb_attempts"] else None,
            "Choke%":      (100.0 * m["ch_fail"]    / m["ch_attempts"]) if m["ch_attempts"]  else None,
            "HammerFactor(pp)": (he - sd) if (he is not None and sd is not None) else None,
            "Record": f"{m['wins']} - {m['losses']}",
            "Score":  f"{m['score_for']} - {m['score_against']}",
            "LSFE":   f"{m['lsfe_w']} - {m['lsfe_l']}",
            "NLSFE":  f"{m['nlsfe_w']} - {m['nlsfe_l']}",
            "StealsFor": m["steals_for"], "ForPoints": m["for_points"],
            "StealsAgainst": m["steals_against"], "AgainstPoints": m["against_points"],
            "Ends": m["ends_played"],
        })
    return M
