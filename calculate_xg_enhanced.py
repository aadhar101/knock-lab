"""
Enhanced xG calculation with proper edge case handling
Fixes:
1. Open goal / tap-in situations
2. Empty net scenarios
3. Very close range shots
4. Unrealistic defensive impacts
"""
import numpy as np
import pickle
import os

def calculate_xg_enhanced(shot_x, shot_y, gk_x, gk_y, defenders, shot_params, target_goal='right'):
    """
    Enhanced xG calculation with proper edge case handling
    """

    # Calculate basic metrics
    if target_goal == 'left':
        goal_x = 0
        goal_y = 34
        distance_to_goal = np.sqrt((shot_x - 0)**2 + (shot_y - 34)**2)
        # Calculate actual angle between shot position and goal posts
        goal_y1, goal_y2 = 34 - 3.66, 34 + 3.66  # Goal posts at y=30.34 and y=37.66
        v1 = np.array([goal_x - shot_x, goal_y1 - shot_y])
        v2 = np.array([goal_x - shot_x, goal_y2 - shot_y])
    else:
        goal_x = 105
        goal_y = 34
        distance_to_goal = np.sqrt((shot_x - 105)**2 + (shot_y - 34)**2)
        # Calculate actual angle between shot position and goal posts
        goal_y1, goal_y2 = 34 - 3.66, 34 + 3.66  # Goal posts at y=30.34 and y=37.66
        v1 = np.array([goal_x - shot_x, goal_y1 - shot_y])
        v2 = np.array([goal_x - shot_x, goal_y2 - shot_y])

    # Calculate angle between vectors to goal posts
    dot_product = np.dot(v1, v2)
    norms = np.linalg.norm(v1) * np.linalg.norm(v2)
    if norms > 0:
        cos_angle = dot_product / norms
        angle_to_goal = np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))
    else:
        angle_to_goal = 0  # Shot from goal line

    gk_distance = np.sqrt((shot_x - gk_x)**2 + (shot_y - gk_y)**2)

    # EDGE CASE 1: TAP-IN / OPEN GOAL
    # If very close to goal with no defenders nearby and GK far away
    if distance_to_goal <= 6:  # Within 6 meters of goal
        # Count close defenders
        close_defenders = 0
        for def_x, def_y in defenders:
            if np.sqrt((shot_x - def_x)**2 + (shot_y - def_y)**2) <= 3:
                close_defenders += 1

        # Check if GK is TRULY out of position (improved detection)
        # GK on goal line but off-center should NOT count as "out of position"
        gk_on_line = (abs(gk_x - goal_x) <= 2)  # GK within 2m of goal line
        # GK is truly out if: far from goal line (>10m) OR extremely far from shot (>15m)
        gk_away_from_goal = abs(goal_x - gk_x)
        gk_truly_out = (gk_away_from_goal > 10 or gk_distance > 15) and not gk_on_line

        if close_defenders == 0 and gk_truly_out:
            # Open goal / tap-in situation
            # Improved distance-based scaling for tap-ins
            if distance_to_goal <= 1:
                base_xg = 0.99  # Almost certain from 1m
            elif distance_to_goal <= 2:
                base_xg = 0.97  # Very high from 2m
            elif distance_to_goal <= 3:
                base_xg = 0.93  # High from 3m
            elif distance_to_goal <= 4:
                base_xg = 0.88  # Good chance from 4m
            elif distance_to_goal <= 5:
                base_xg = 0.82  # Decent chance from 5m
            else:
                base_xg = 0.75  # Still good from 6m

            # Apply shot parameter modifiers even for tap-ins
            shot_params_impact = _calculate_shot_params_impact(shot_params)
            base_xg = base_xg * shot_params_impact
            base_xg = max(0.01, min(0.99, base_xg))

            return {
                'xg': base_xg,
                'distance': distance_to_goal,
                'angle': angle_to_goal,
                'defender_impact': {'very_close': 0, 'close': 0, 'nearby': 0, 'area': 0},
                'gk_distance': gk_distance,
                'shot_params_impact': shot_params_impact
            }

    # EDGE CASE 2: EMPTY NET (GK truly far from shot - e.g., at midfield)
    # Use GK's X position to determine if they're far from goal
    gk_away_from_goal = abs(goal_x - gk_x)
    if gk_away_from_goal > 15 and distance_to_goal <= 30:
        # GK is way out of position - essentially empty net
        # The further the GK, the higher the xG
        if gk_away_from_goal > 25:  # GK extremely far (30m+ from goal line)
            if distance_to_goal <= 12:
                base_xg = 0.95  # Near certain goal
            elif distance_to_goal <= 18:
                base_xg = 0.85
            else:
                base_xg = 0.75
        elif distance_to_goal <= 10:
            base_xg = 0.90
        elif distance_to_goal <= 18:
            base_xg = 0.75
        else:
            base_xg = 0.60

        # Reduce slightly if defenders are present
        for def_x, def_y in defenders:
            if np.sqrt((shot_x - def_x)**2 + (shot_y - def_y)**2) <= 2:
                base_xg *= 0.85  # 15% reduction per very close defender

        # Apply shot parameter modifiers
        shot_params_impact = _calculate_shot_params_impact(shot_params)
        base_xg = base_xg * shot_params_impact

        return {
            'xg': max(0.01, min(0.99, base_xg)),
            'distance': distance_to_goal,
            'angle': angle_to_goal,
            'defender_impact': _count_defenders_in_zones(shot_x, shot_y, defenders),
            'gk_distance': gk_distance,
            'shot_params_impact': shot_params_impact
        }

    # Check for penalty
    is_penalty = shot_params and shot_params.get('situation') == 'Penalty'

    if is_penalty:
        # Use data-driven penalty rates from full dataset analysis
        try:
            import json
            with open('shot_parameter_modifiers.json', 'r') as f:
                modifiers = json.load(f)
                # Get penalty conversion rate from the situation stats
                base_xg = modifiers['situation']['Penalty']['conversion_rate']
        except:
            # Fallback to previously calculated penalty rates
            try:
                with open('penalty_conversion_rates.json', 'r') as f:
                    penalty_rates = json.load(f)
                    base_xg = penalty_rates['overall']
            except:
                base_xg = 0.7735  # From dataset: 77.35%

        # Slight adjustment based on foot preference (optional)
        body_part = shot_params.get('bodyPart', 'Right Foot') if shot_params else 'Right Foot'
        if body_part == 'Right Foot':
            base_xg *= 1.02  # Slight advantage for right foot
        elif body_part == 'Left Foot':
            base_xg *= 0.98  # Slight disadvantage for left foot

        # Ensure penalty xG stays within realistic bounds
        base_xg = min(0.85, max(0.70, base_xg))

        return {
            'xg': base_xg,
            'distance': distance_to_goal,
            'angle': angle_to_goal,
            'defender_impact': {},
            'gk_distance': gk_distance,
            'shot_params_impact': 1.0
        }

    # Try to use models in order: Ultimate > GK-aware > Defender-aware
    loaded_model_type = None
    try:
        # Try Ultimate model first (most features)
        try:
            with open('ultimate_xg_model.pkl', 'rb') as f:
                model = pickle.load(f)
            with open('ultimate_xg_scaler.pkl', 'rb') as f:
                scaler = pickle.load(f)
            with open('ultimate_xg_features.pkl', 'rb') as f:
                features = pickle.load(f)
            loaded_model_type = "ultimate"
        except:
            # Fallback to GK-aware model (has augmented GK training data)
            try:
                with open('gk_aware_model.pkl', 'rb') as f:
                    model = pickle.load(f)
                with open('gk_aware_scaler.pkl', 'rb') as f:
                    scaler = pickle.load(f)
                with open('gk_aware_features.pkl', 'rb') as f:
                    features = pickle.load(f)
                loaded_model_type = "gk_aware"
            except:
                # Fallback to defender-aware model
                with open('defender_aware_model.pkl', 'rb') as f:
                    model = pickle.load(f)
                with open('defender_aware_scaler.pkl', 'rb') as f:
                    scaler = pickle.load(f)
                with open('defender_aware_features.pkl', 'rb') as f:
                    features = pickle.load(f)
                loaded_model_type = "defender_aware"

        # Prepare features
        feature_dict = _prepare_features(
            shot_x, shot_y, gk_x, gk_y, defenders,
            shot_params, distance_to_goal, angle_to_goal,
            gk_distance, goal_x, goal_y, target_goal
        )

        # Create feature array
        X = np.array([[feature_dict.get(f, 0) for f in features]])

        # Scale and predict
        X_scaled = scaler.transform(X)
        xg_base = model.predict_proba(X_scaled)[0, 1]

        # IMPORTANT: Apply realistic bounds based on situation
        # Force realistic values based on actual data conversion rates
        xg_base = _apply_realistic_bounds(
            xg_base, distance_to_goal, angle_to_goal,
            gk_distance, defenders, shot_x, shot_y
        )

    except:
        # Fallback to simple calculation
        xg_base = _simple_xg_calculation(
            distance_to_goal, angle_to_goal, gk_distance, defenders, shot_x, shot_y
        )

    # Override model for unrealistic long-range predictions
    # The model wasn't trained well on long-range shots, so use data-driven values
    if distance_to_goal > 22:
        xg_base = _simple_xg_calculation(
            distance_to_goal, angle_to_goal, gk_distance, defenders, shot_x, shot_y
        )

    # CALIBRATION: Ultimate model trained on augmented data (55.8% goal rate vs 9.5% real)
    # Simple piecewise linear calibration based on empirical conversion rates
    if loaded_model_type == "ultimate":
        # Calibration mapping: model_pred → actual_probability
        # Tuned based on: 15m≈11%, 10m≈22%, 5m≈45%, tap-in≈55%, GK-off≈85%
        if xg_base >= 0.95:
            xg_base = 0.85 + (xg_base - 0.95) * 2.0  # [0.95-1.0] → [0.85-0.95]
        elif xg_base >= 0.80:
            xg_base = 0.70 + (xg_base - 0.80) * 1.0  # [0.80-0.95] → [0.70-0.85]
        elif xg_base >= 0.50:
            xg_base = 0.40 + (xg_base - 0.50) * 1.0  # [0.50-0.80] → [0.40-0.70]
        elif xg_base >= 0.30:
            xg_base = 0.18 + (xg_base - 0.30) * 1.1  # [0.30-0.50] → [0.18-0.40]
        else:
            xg_base = xg_base * 0.6  # [0.0-0.30] → [0.0-0.18]

    # Calculate PURE base xG (no modifiers at all)
    pure_base_params = {
        'bodyPart': 'Right Foot',
        'shotType': 'Shot',
        'situation': 'Open Play',
        'previousAction': 'Pass',
        'playerPosition': 'Striker',
        'matchTime': 45,
        'scoresDiff': 0,
        'shotPower': 75,  # Neutral
        'shotPlacement': 5  # Neutral
    }
    pure_impact = _calculate_shot_params_impact(pure_base_params)
    pure_base_xg = xg_base / pure_impact if pure_impact != 0 else xg_base

    print(f"📊 PURE Base xG (no modifiers): {pure_base_xg:.4f} ({pure_base_xg*100:.1f}%)")
    print(f"📊 Model xG (with default params): {xg_base:.4f} ({xg_base*100:.1f}%)")

    # Apply shot parameter modifiers
    shot_params_impact = _calculate_shot_params_impact(shot_params)
    xg_final = xg_base * shot_params_impact

    print(f"✅ Final xG (all modifiers): {xg_final:.4f} ({xg_final*100:.1f}%)")

    # POST-PROCESSING: Apply defender reduction when GK is off-center
    # This handles cases where model learned "GK off = goal" but doesn't account for heavy defense
    gk_off_center = abs(gk_y - goal_y)
    if gk_off_center > 5 and xg_final > 0.70:  # GK off-center AND high xG
        # Count defenders in shooting corridor (between shot and goal)
        defenders_blocking = 0
        defenders_near = 0

        for dx, dy in defenders:
            # Distance to shot
            dist_to_shot = np.sqrt((shot_x - dx)**2 + (shot_y - dy)**2)

            # Count defenders in defensive area when GK is far off
            # Logic: if GK abandoned position, defenders in box/defensive third matter
            if target_goal == 'right':
                in_defensive_area = dx >= shot_x - 5 and dx < goal_x + 2  # Allow defenders slightly behind shot
            else:
                in_defensive_area = dx <= shot_x + 5 and dx > goal_x - 2

            if dist_to_shot <= 5:
                defenders_near += 1  # Very close to shooter
            elif in_defensive_area and dist_to_shot <= 25:  # In defensive area
                defenders_blocking += 1

        total_defensive_presence = defenders_near * 2 + defenders_blocking  # Weight close defenders more

        # Scale reduction based on how far GK is off
        gk_factor = min(1.0, gk_off_center / 15.0)  # 0.33 at 5m off, 1.0 at 15m+ off

        if total_defensive_presence >= 4:
            # Heavy defense: reduce by 15-30% (scaled by GK distance)
            base_reduction = 0.15 + (total_defensive_presence - 4) * 0.03
            reduction = base_reduction * (0.7 + 0.3 * gk_factor)  # Less reduction when GK very far
            xg_final = xg_final * (1 - min(0.30, reduction))
        elif total_defensive_presence >= 2:
            # Moderate defense: reduce by 8-15%
            base_reduction = 0.08 + (total_defensive_presence - 2) * 0.02
            reduction = base_reduction * (0.7 + 0.3 * gk_factor)
            xg_final = xg_final * (1 - min(0.15, reduction))

    # Final bounds check
    xg_final = max(0.01, min(0.99, xg_final))

    # Determine which model was used
    model_used = "unknown"
    try:
        if os.path.exists('ultimate_xg_model.pkl'):
            model_used = "ultimate"
        elif os.path.exists('gk_aware_model.pkl'):
            model_used = "gk_aware"
        elif os.path.exists('defender_aware_model.pkl'):
            model_used = "defender_aware"
        else:
            model_used = "fallback"
    except:
        model_used = "unknown"

    # Calculate defender impact details
    defender_zones = _count_defenders_in_zones(shot_x, shot_y, defenders)

    # Calculate total defender impact magnitude
    defender_reduction = 0
    if len(defenders) > 0:
        # Calculate how much defenders reduced xG
        # This is approximate based on defensive presence
        defender_reduction = min(0.50, defender_zones['very_close'] * 0.15 +
                                       defender_zones['close'] * 0.10 +
                                       defender_zones['nearby'] * 0.05 +
                                       defender_zones['area'] * 0.02)

    # Add impact magnitude to defender_zones
    defender_zones['total_reduction'] = round(defender_reduction, 3)
    if defender_zones['very_close'] > 0:
        defender_zones['closest_impact'] = round(defender_zones['very_close'] * 0.15, 3)
    else:
        defender_zones['closest_impact'] = 0

    return {
        'xg': xg_final,
        'distance': distance_to_goal,
        'angle': angle_to_goal,
        'defender_impact': defender_zones,
        'gk_distance': gk_distance,
        'shot_params_impact': shot_params_impact,
        'model_used': model_used
    }

def _apply_realistic_bounds(xg, distance, angle, gk_distance, defenders, shot_x, shot_y):
    """Apply minimal bounds to prevent extreme unrealistic values"""

    # Only apply very basic sanity checks, let the model do the work
    # Just prevent completely impossible values

    # Absolute maximums based on physics/reality
    if distance > 50:
        xg = min(xg, 0.02)  # Extremely unlikely from 50m+
    elif distance > 40:
        xg = min(xg, 0.03)  # Very unlikely from 40-50m

    # Absolute minimums for clear chances (improved tap-in detection)
    if distance <= 1 and len(defenders) == 0 and gk_distance > 10:
        xg = max(xg, 0.85)  # 1m open tap-in should be at least 85%
    elif distance <= 2 and len(defenders) == 0 and gk_distance > 10:
        xg = max(xg, 0.70)  # 2m open tap-in should be at least 70%
    elif distance <= 3 and len(defenders) == 0 and gk_distance > 10:
        xg = max(xg, 0.55)  # 3m open tap-in should be at least 55%

    return xg

def _simple_xg_calculation(distance, angle, gk_distance, defenders, shot_x, shot_y):
    """Simple fallback xG calculation based on actual dataset conversion rates"""

    # Base xG from distance (from actual 100k dataset analysis)
    if distance <= 5:
        base_xg = 0.070  # ~7% for very close shots
    elif distance <= 10:
        base_xg = 0.069  # 6.95% for 0-10m
    elif distance <= 15:
        base_xg = 0.099  # 9.85% for 10-15m
    elif distance <= 20:
        base_xg = 0.034  # 3.44% for 15-20m
    elif distance <= 25:
        base_xg = 0.020  # 2.02% for 20-25m
    elif distance <= 30:
        base_xg = 0.013  # 1.34% for 25-30m
    elif distance <= 35:
        base_xg = 0.010  # 0.99% for 30-35m
    elif distance <= 40:
        base_xg = 0.005  # 0.53% for 35-40m
    elif distance <= 50:
        base_xg = 0.007  # 0.68% for 40-50m
    else:
        base_xg = 0.009  # 0.93% for 50m+

    # Apply data-driven angle modifier
    angle_modifier = _get_angle_modifier(angle)
    base_xg *= angle_modifier

    # GK distance modifier
    if gk_distance > 15:
        base_xg *= 1.5  # GK far away
    elif gk_distance < 5:
        base_xg *= 0.6  # GK very close

    # Defender impact
    for def_x, def_y in defenders:
        def_dist = np.sqrt((shot_x - def_x)**2 + (shot_y - def_y)**2)
        if def_dist <= 2:
            base_xg *= 0.7  # 30% reduction per very close defender
        elif def_dist <= 4:
            base_xg *= 0.85  # 15% reduction per close defender

    return max(0.01, min(0.99, base_xg))

def _prepare_features(shot_x, shot_y, gk_x, gk_y, defenders, shot_params,
                      distance_to_goal, angle_to_goal, gk_distance, goal_x, goal_y, target_goal):
    """Prepare feature dictionary for model"""

    feature_dict = {}

    # Core features
    feature_dict['x_coord'] = shot_x
    feature_dict['y_coord'] = shot_y
    feature_dict['distance_to_goal'] = distance_to_goal
    feature_dict['angle_to_goal'] = angle_to_goal

    # GK features (enhanced for gk_aware model)
    feature_dict['gk_x'] = gk_x
    feature_dict['gk_y'] = gk_y
    feature_dict['gk_distance'] = gk_distance
    feature_dict['gk_off_center'] = abs(gk_y - goal_y)
    feature_dict['gk_advanced'] = max(0, min(goal_x - gk_x if target_goal == 'right' else gk_x - goal_x, 30)) / 30
    feature_dict['gk_angle_to_shot'] = np.degrees(np.arctan2(shot_y - gk_y, shot_x - gk_x))

    # NEW GK features for gk_aware model
    gk_to_goal_dist = np.sqrt((gk_x - goal_x)**2 + (gk_y - goal_y)**2)
    feature_dict['gk_to_goal_dist'] = gk_to_goal_dist
    feature_dict['gk_coverage_angle'] = np.degrees(np.arctan2(3.66, gk_to_goal_dist + 0.1))

    # GK's distance from shot-to-goal line
    line_dist = abs((shot_y - goal_y) * (goal_x - gk_x) - (shot_x - goal_x) * (goal_y - gk_y))
    line_length = np.sqrt((shot_y - goal_y)**2 + (shot_x - goal_x)**2 + 0.1)
    feature_dict['gk_shot_line_distance'] = line_dist / line_length

    # NEW: Shot Quality Features (for Ultimate model)
    # REMOVED: shot_power and shot_placement should NOT be model features
    # They are applied as post-prediction modifiers for transparency
    # Using default neutral values so model ignores these
    shot_power = 75  # Default neutral value
    shot_placement = 5  # Default neutral value
    feature_dict['shot_power'] = shot_power
    feature_dict['shot_placement'] = shot_placement
    feature_dict['normalized_shot_power'] = (shot_power - 50) / 50
    feature_dict['normalized_shot_placement'] = shot_placement / 10
    feature_dict['shot_quality_score'] = feature_dict['normalized_shot_power'] * feature_dict['normalized_shot_placement']
    feature_dict['power_distance_interaction'] = shot_power / (distance_to_goal + 1)
    feature_dict['placement_gk_interaction'] = shot_placement * feature_dict['gk_coverage_angle']
    feature_dict['power_category_weak'] = 1 if shot_power < 65 else 0
    feature_dict['power_category_strong'] = 1 if shot_power > 85 else 0
    feature_dict['placement_category_good'] = 1 if shot_placement > 7 else 0

    # NEW: Pressure & First Touch (for Ultimate model)
    feature_dict['is_first_touch'] = 1 if shot_params and shot_params.get('firstTouch') else 0
    feature_dict['is_under_pressure'] = 1 if shot_params and shot_params.get('underPressure') else 0
    feature_dict['first_touch_difficulty'] = feature_dict['is_first_touch'] * distance_to_goal
    feature_dict['pressure_distance_interaction'] = feature_dict['is_under_pressure'] * distance_to_goal
    feature_dict['pressure_angle_reduction'] = feature_dict['is_under_pressure'] * (90 - angle_to_goal)
    feature_dict['quality_under_pressure'] = feature_dict['shot_quality_score'] * (1 - feature_dict['is_under_pressure'] * 0.3)
    feature_dict['first_touch_quality'] = feature_dict['is_first_touch'] * distance_to_goal * feature_dict['is_under_pressure']

    # NEW: Game State (for Ultimate model)
    match_time = shot_params.get('matchTime', 45) if shot_params else 45
    match_score_diff = shot_params.get('scoresDiff', 0) if shot_params else 0
    is_first_half = match_time < 45
    feature_dict['match_score_diff'] = match_score_diff
    feature_dict['is_losing'] = 1 if match_score_diff < 0 else 0
    feature_dict['is_winning'] = 1 if match_score_diff > 0 else 0
    feature_dict['is_drawing'] = 1 if match_score_diff == 0 else 0
    feature_dict['desperation_factor'] = 1.5 if (match_score_diff < 0 and match_time >= 75) else 1.0
    feature_dict['score_time_interaction'] = match_score_diff * match_time
    feature_dict['is_first_half'] = 1 if is_first_half else 0
    feature_dict['is_second_half'] = 0 if is_first_half else 1
    feature_dict['half_minute'] = match_time if is_first_half else match_time - 45

    # Process defenders
    defenders_very_close = 0
    defenders_close = 0
    defenders_nearby = 0
    defenders_blocking = 0
    defender_distances = []

    for i in range(1, 9):  # ALL 8 defenders for Ultimate model
        if i <= len(defenders):
            def_x, def_y = defenders[i-1]
        else:
            def_x = shot_x + 20
            def_y = shot_y

        feature_dict[f'def{i}_x'] = def_x
        feature_dict[f'def{i}_y'] = def_y

        def_distance = np.sqrt((shot_x - def_x)**2 + (shot_y - def_y)**2)
        feature_dict[f'def{i}_distance'] = def_distance

        is_blocking = (
            (def_x > shot_x) and
            (def_x < 105) and
            (abs(def_y - 34) < 10)
        )
        feature_dict[f'def{i}_blocking'] = 1 if is_blocking else 0

        if i <= len(defenders):
            defender_distances.append(def_distance)
            if def_distance <= 2:
                defenders_very_close += 1
            if def_distance <= 3.5:
                defenders_close += 1
            if def_distance <= 5:
                defenders_nearby += 1
            if is_blocking:
                defenders_blocking += 1

    # Aggregate features
    feature_dict['defenders_very_close'] = defenders_very_close
    feature_dict['defenders_close'] = defenders_close
    feature_dict['defenders_nearby'] = defenders_nearby
    feature_dict['defenders_blocking'] = defenders_blocking

    if defender_distances:
        feature_dict['closest_defender_dist'] = min(defender_distances)
        feature_dict['avg_closest_3_defenders'] = np.mean(sorted(defender_distances)[:3])
    else:
        feature_dict['closest_defender_dist'] = 10
        feature_dict['avg_closest_3_defenders'] = 10

    # Corridor defenders
    corridor_count = 0
    for def_x, def_y in defenders:
        if (def_x > shot_x - 2) and (def_x < 105) and (abs(def_y - shot_y) < 5):
            corridor_count += 1
    feature_dict['corridor_defenders'] = corridor_count
    feature_dict['defensive_density'] = defenders_close / (distance_to_goal + 1)

    # NEW: Defensive depth & compactness (for Ultimate model)
    if len(defender_distances) > 0:
        feature_dict['defensive_compactness'] = np.std(defender_distances) if len(defender_distances) > 1 else 0
        feature_dict['second_line_defenders'] = sum(1 for d in defender_distances if 5 < d < 10)
    else:
        feature_dict['defensive_compactness'] = 0
        feature_dict['second_line_defenders'] = 0

    # NEW: Advanced spatial features (for Ultimate model)
    feature_dict['shooting_lane_width'] = angle_to_goal / (defenders_blocking + 1)
    feature_dict['effective_goal_size'] = 7.32 * (1 - min(defenders_blocking / 5, 0.8))

    # Time features
    match_time = shot_params.get('matchTime', 45) if shot_params else 45
    feature_dict['minute'] = match_time
    feature_dict['is_late_game'] = 1 if match_time >= 75 else 0
    feature_dict['is_injury_time'] = 1 if match_time >= 90 else 0
    feature_dict['fatigue_factor'] = min(match_time / 90, 1.0)

    # Shot characteristics
    feature_dict['is_header'] = 1 if shot_params and shot_params.get('bodyPart') == 'Head' else 0
    feature_dict['center_distance'] = abs(shot_y - goal_y)
    feature_dict['distance_angle_interaction'] = distance_to_goal * (90 - angle_to_goal) / 90
    feature_dict['is_close_shot'] = 1 if distance_to_goal <= 15 else 0
    feature_dict['is_central'] = 1 if feature_dict['center_distance'] <= 8 else 0
    feature_dict['clear_path'] = 1 if defenders_close == 0 else 0
    feature_dict['shot_window'] = angle_to_goal / (defenders_blocking + 1)

    # Mathematical features
    feature_dict['log_distance'] = np.log1p(distance_to_goal)
    feature_dict['sin_angle'] = np.sin(np.radians(angle_to_goal))
    feature_dict['cos_angle'] = np.cos(np.radians(angle_to_goal))
    feature_dict['shot_difficulty'] = distance_to_goal / (angle_to_goal + 1)
    feature_dict['pressure_factor'] = defenders_close * gk_distance / 10

    # NEW: Interaction features (for gk_aware and Ultimate models)
    feature_dict['gk_defender_interaction'] = gk_to_goal_dist * defenders_blocking
    feature_dict['gk_distance_shot_difficulty'] = gk_distance * feature_dict['shot_difficulty']

    # NEW: Ultimate model combination features
    # Using neutral defaults for shot_power/shot_placement since they're modifiers
    feature_dict['gk_challenge_difficulty'] = 75 * 5 * feature_dict['gk_coverage_angle']
    feature_dict['desperation_shot'] = feature_dict['is_losing'] * (1 if match_time > 80 else 0) * feature_dict['is_under_pressure']

    return feature_dict

def _calculate_shot_params_impact(shot_params):
    """Calculate impact of shot parameters using data-driven modifiers"""
    impact = 1.0

    # Load data-driven modifiers
    try:
        import json
        with open('shot_parameter_modifiers.json', 'r') as f:
            modifiers = json.load(f)
    except:
        # Fallback to default values if file not found
        modifiers = {
            'body_part': {'Foot': {'modifier': 1.046}, 'Head': {'modifier': 0.756}, 'Other': {'modifier': 0.506}},
            'shot_type': {'Volley': {'modifier': 1.024}, 'Shot': {'modifier': 1.005}, 'HalfVolley': {'modifier': 0.854}},
            'first_touch_modifier': 0.951,
            'under_pressure_modifier': 1.010
        }

    # Load extended filter modifiers
    try:
        with open('all_filter_modifiers.json', 'r') as f:
            all_modifiers = json.load(f)
    except:
        all_modifiers = {}

    if shot_params:
        # Body part modifier (data-driven)
        body_part = shot_params.get('bodyPart', 'Right Foot')
        if 'Foot' in body_part:
            body_part_key = 'Foot'
        elif body_part == 'Head':
            body_part_key = 'Head'
        else:
            body_part_key = 'Other'

        if body_part_key in modifiers.get('body_part', {}):
            impact *= modifiers['body_part'][body_part_key]['modifier']

        # Shot type modifier (data-driven)
        shot_type = shot_params.get('shotType', 'Shot')

        # Map UI shot types to data categories
        shot_type_mapping = {
            'Placed': 'Shot',
            'Power': 'Shot',
            'Chip': 'Shot',
            'Volley': 'Volley',
            'Half-Volley': 'HalfVolley',
            'Shot': 'Shot'
        }

        data_shot_type = shot_type_mapping.get(shot_type, 'Shot')
        if data_shot_type in modifiers.get('shot_type', {}):
            impact *= modifiers['shot_type'][data_shot_type]['modifier']

        # First touch modifier (data-driven)
        if shot_params.get('firstTouch'):
            impact *= modifiers.get('first_touch_modifier', 0.951)

        # Under pressure modifier (data-driven)
        if shot_params.get('underPressure'):
            impact *= modifiers.get('under_pressure_modifier', 1.010)

        # SITUATION MODIFIER (data-driven from 100k dataset)
        situation = shot_params.get('situation', 'OpenPlay')
        if situation != 'Penalty' and 'situation' in all_modifiers:
            situation_modifiers = all_modifiers['situation']
            if situation in situation_modifiers:
                impact *= situation_modifiers[situation].get('modifier', 1.0)
            else:
                # Default modifiers based on data
                default_situation = {
                    'OpenPlay': 0.772,
                    'Counter': 0.935,
                    'Counter Attack': 0.935,
                    'Fast Break': 0.935,
                    'SetPiece': 0.740,
                    'Set Piece': 0.740,
                    'Free Kick': 0.740
                }
                impact *= default_situation.get(situation, 1.0)

        # PREVIOUS ACTION MODIFIER (data-driven)
        prev_action = shot_params.get('previousAction', 'Pass')
        if 'previous_action' in all_modifiers:
            prev_modifiers = all_modifiers['previous_action']
            if prev_action in prev_modifiers:
                impact *= prev_modifiers[prev_action].get('modifier', 1.0)
            else:
                # Default modifiers based on data
                default_prev_action = {
                    'Pass': 1.032,
                    'Through Ball': 1.100,  # Slightly better than pass
                    'Cross': 0.851,
                    'Dribble': 0.965,
                    'Rebound': 1.211,
                    'Corner': 0.740,  # Similar to set piece
                    'Free Kick': 0.740
                }
                impact *= default_prev_action.get(prev_action, 1.0)

        # PLAYER POSITION MODIFIER (data-driven or typical)
        player_position = shot_params.get('playerPosition', 'Forward')
        if 'player_position' in all_modifiers:
            pos_modifiers = all_modifiers['player_position']
            if player_position in pos_modifiers:
                impact *= pos_modifiers[player_position].get('modifier', 1.0)
            else:
                # Default modifiers
                default_positions = {
                    'Forward': 1.150,
                    'Striker': 1.150,
                    'Winger': 0.950,
                    'Midfielder': 0.850,
                    'Defender': 0.700,
                    'Goalkeeper': 0.500
                }
                impact *= default_positions.get(player_position, 1.0)

        # MATCH TIME MODIFIER (fatigue/urgency effects)
        match_time = shot_params.get('matchTime', 45)
        if match_time >= 75:
            impact *= 0.92  # Late game fatigue
        elif match_time >= 90:
            impact *= 1.05  # Urgency in injury time

        # SHOT POWER MODIFIER (NEW)
        # Higher power = harder for GK to save = higher xG
        impact_before_quality = impact
        shot_power = shot_params.get('shotPower', 75)
        print(f"🔧 Shot Power received: {shot_power} | Impact before quality: {impact_before_quality:.4f}")
        if shot_power >= 90:
            impact *= 1.15  # Thunderbolt: +15%
        elif shot_power >= 80:
            impact *= 1.12  # Strong shot: +12%
        elif shot_power >= 70:
            impact *= 1.08  # Above average: +8%
        elif shot_power >= 60:
            impact *= 1.04  # Normal: +4%
        else:
            impact *= 0.92  # Weak shot: -8%

        # SHOT PLACEMENT MODIFIER (NEW)
        # Better placement = harder to save = higher xG
        shot_placement = shot_params.get('shotPlacement', 5)
        print(f"🎯 Shot Placement received: {shot_placement}")
        if shot_placement >= 9:
            impact *= 1.18  # Perfect corner: +18%
        elif shot_placement >= 7:
            impact *= 1.12  # Good placement: +12%
        elif shot_placement >= 5:
            impact *= 1.06  # Average: +6%
        elif shot_placement >= 3:
            impact *= 1.0   # Below average: no change
        else:
            impact *= 0.88  # Poor placement: -12%

        print(f"✅ FINAL Impact (all modifiers): {impact:.4f}")

        # SCORE DIFFERENCE MODIFIER (NEW)
        # Desperation affects shot quality
        score_diff = shot_params.get('scoresDiff', 0)
        if score_diff < 0 and match_time >= 75:
            impact *= 0.95  # Losing late = desperate/rushed shots: -5%
        elif score_diff > 0:
            impact *= 1.02  # Winning = confidence: +2%

    return impact

def _get_angle_modifier(angle):
    """Get data-driven angle modifier based on historical conversion rates"""

    # Load angle modifiers from data analysis
    try:
        import json
        with open('angle_modifiers.json', 'r') as f:
            angle_data = json.load(f)
    except:
        # Fallback to default if file not found
        # Based on the analysis: optimal at 40-50°, poor at <10°
        if angle < 10:
            return 0.13
        elif angle < 20:
            return 0.35
        elif angle < 30:
            return 0.67
        elif angle < 40:
            return 1.12
        elif angle < 50:
            return 3.67  # Peak conversion rate!
        elif angle < 60:
            return 1.79
        elif angle < 70:
            return 1.80
        elif angle < 80:
            return 1.60
        elif angle < 90:
            return 2.06
        else:
            return 0.50  # Very wide angles

    # Find the appropriate angle bin
    if angle < 10:
        return angle_data.get('0-10°', {}).get('modifier', 0.13)
    elif angle < 20:
        return angle_data.get('10-20°', {}).get('modifier', 0.35)
    elif angle < 30:
        return angle_data.get('20-30°', {}).get('modifier', 0.67)
    elif angle < 40:
        return angle_data.get('30-40°', {}).get('modifier', 1.12)
    elif angle < 50:
        return angle_data.get('40-50°', {}).get('modifier', 3.67)
    elif angle < 60:
        return angle_data.get('50-60°', {}).get('modifier', 1.79)
    elif angle < 70:
        return angle_data.get('60-70°', {}).get('modifier', 1.80)
    elif angle < 80:
        return angle_data.get('70-80°', {}).get('modifier', 1.60)
    elif angle < 90:
        return angle_data.get('80-90°', {}).get('modifier', 2.06)
    else:
        return 0.50  # Very wide angles

def _count_defenders_in_zones(shot_x, shot_y, defenders):
    """Count defenders in different zones"""
    zones = {'very_close': 0, 'close': 0, 'nearby': 0, 'area': 0}

    for def_x, def_y in defenders:
        dist = np.sqrt((shot_x - def_x)**2 + (shot_y - def_y)**2)
        if dist <= 2:
            zones['very_close'] += 1
        elif dist <= 3.5:
            zones['close'] += 1
        elif dist <= 5:
            zones['nearby'] += 1
        elif dist <= 7:
            zones['area'] += 1

    return zones