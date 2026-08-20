"""
PSxG (Post-Shot Expected Goals) Calculation Module
Calculates the probability of a goal based on shot placement, speed, and GK position
"""

import numpy as np
import pickle
import os

# Goal dimensions
GOAL_WIDTH = 7.32
GOAL_HEIGHT = 2.44
GOAL_CENTER_X = GOAL_WIDTH / 2
GOAL_CENTER_Y = GOAL_HEIGHT / 2

# GK biomechanics
GK_DIVE_SPEED_HORIZONTAL = 4.0  # m/s
GK_DIVE_SPEED_VERTICAL = 2.5  # m/s
GK_REACTION_TIME = 0.15  # seconds


def calculate_psxg(shot_end_x, shot_end_y, shot_speed, gk_x, gk_y, shot_distance=15.0):
    """
    Calculate PSxG (Post-Shot Expected Goals)

    Parameters:
    -----------
    shot_end_x : float
        Horizontal position where ball is heading in goal (0-7.32m, 0=left post)
    shot_end_y : float
        Vertical position where ball is heading in goal (0-2.44m, 0=ground)
    shot_speed : float
        Shot speed in km/h
    gk_x : float
        Goalkeeper horizontal position in goal frame (0-7.32m)
    gk_y : float
        Goalkeeper vertical position (usually 0-0.5m for standing)
    shot_distance : float
        Distance from which shot was taken (meters)

    Returns:
    --------
    dict with psxg value and breakdown metrics
    """

    # Validate inputs
    shot_end_x = np.clip(shot_end_x, 0.01, GOAL_WIDTH - 0.01)
    shot_end_y = np.clip(shot_end_y, 0.01, GOAL_HEIGHT - 0.01)
    shot_speed = np.clip(shot_speed, 40, 130)
    gk_x = np.clip(gk_x, 0.5, GOAL_WIDTH - 0.5)
    gk_y = np.clip(gk_y, 0, 1.5)
    shot_distance = np.clip(shot_distance, 5, 40)

    # Try to use trained model first
    try:
        psxg, model_used = _calculate_with_model(
            shot_end_x, shot_end_y, shot_speed, gk_x, gk_y, shot_distance
        )
    except Exception as e:
        print(f"Model not available, using physics-based calculation: {e}")
        psxg = _calculate_physics_based(
            shot_end_x, shot_end_y, shot_speed, gk_x, gk_y, shot_distance
        )
        model_used = "physics"

    # Calculate additional metrics
    gk_dive_distance = np.sqrt((shot_end_x - gk_x)**2 + (shot_end_y - gk_y)**2)
    ball_travel_time = _calculate_ball_travel_time(shot_speed, shot_distance)
    gk_reach_time = _calculate_gk_reach_time(gk_x, gk_y, shot_end_x, shot_end_y)
    time_margin = ball_travel_time - (gk_reach_time + GK_REACTION_TIME)

    # Determine zone
    zone = _get_zone(shot_end_x, shot_end_y)

    # Determine save difficulty
    if psxg >= 0.85:
        save_difficulty = "Nearly Impossible"
    elif psxg >= 0.70:
        save_difficulty = "Very Hard"
    elif psxg >= 0.50:
        save_difficulty = "Hard"
    elif psxg >= 0.35:
        save_difficulty = "Medium"
    elif psxg >= 0.20:
        save_difficulty = "Moderate"
    else:
        save_difficulty = "Easy"

    return {
        'psxg': round(psxg, 4),
        'zone': zone,
        'gk_dive_distance': round(gk_dive_distance, 2),
        'ball_travel_time': round(ball_travel_time, 3),
        'gk_reach_time': round(gk_reach_time, 3),
        'time_margin': round(time_margin, 3),
        'save_difficulty': save_difficulty,
        'model_used': model_used,
        'shot_speed': shot_speed,
        'dist_from_center': round(np.sqrt((shot_end_x - GOAL_CENTER_X)**2 +
                                          (shot_end_y - GOAL_CENTER_Y)**2), 2)
    }


def _calculate_with_model(shot_end_x, shot_end_y, shot_speed, gk_x, gk_y, shot_distance):
    """Calculate PSxG using trained model"""

    # Load model artifacts
    with open('psxg_model.pkl', 'rb') as f:
        model = pickle.load(f)
    with open('psxg_scaler.pkl', 'rb') as f:
        scaler = pickle.load(f)
    with open('psxg_features.pkl', 'rb') as f:
        feature_names = pickle.load(f)

    # Calculate all required features
    features = _prepare_features(shot_end_x, shot_end_y, shot_speed, gk_x, gk_y, shot_distance)

    # Create feature array in correct order
    X = np.array([[features.get(f, 0) for f in feature_names]])

    # Scale and predict
    X_scaled = scaler.transform(X)
    psxg = model.predict_proba(X_scaled)[0, 1]

    return float(psxg), "xgboost"


def _prepare_features(shot_end_x, shot_end_y, shot_speed, gk_x, gk_y, shot_distance):
    """Prepare feature dictionary matching training features"""

    features = {}

    # Base features
    features['shot_end_x'] = shot_end_x
    features['shot_end_y'] = shot_end_y
    features['shot_speed'] = shot_speed
    features['shot_distance'] = shot_distance
    features['gk_x'] = gk_x
    features['gk_y'] = gk_y

    # Calculated features
    features['gk_dive_distance'] = np.sqrt((shot_end_x - gk_x)**2 + (shot_end_y - gk_y)**2)
    features['ball_travel_time'] = _calculate_ball_travel_time(shot_speed, shot_distance)
    features['dist_from_center'] = np.sqrt((shot_end_x - GOAL_CENTER_X)**2 +
                                            (shot_end_y - GOAL_CENTER_Y)**2)
    features['dist_from_left_post'] = shot_end_x
    features['dist_from_right_post'] = GOAL_WIDTH - shot_end_x
    features['dist_from_crossbar'] = GOAL_HEIGHT - shot_end_y
    features['dist_from_ground'] = shot_end_y

    # Derived features (must match training)
    features['shot_end_x_normalized'] = shot_end_x / GOAL_WIDTH
    features['shot_end_y_normalized'] = shot_end_y / GOAL_HEIGHT
    features['gk_offset_x'] = shot_end_x - gk_x
    features['gk_offset_y'] = shot_end_y - gk_y

    # Corner distances
    features['corner_distance_tl'] = np.sqrt(shot_end_x**2 + (GOAL_HEIGHT - shot_end_y)**2)
    features['corner_distance_tr'] = np.sqrt((GOAL_WIDTH - shot_end_x)**2 + (GOAL_HEIGHT - shot_end_y)**2)
    features['corner_distance_bl'] = np.sqrt(shot_end_x**2 + shot_end_y**2)
    features['corner_distance_br'] = np.sqrt((GOAL_WIDTH - shot_end_x)**2 + shot_end_y**2)

    # Binary features
    features['is_top_half'] = 1 if shot_end_y > GOAL_HEIGHT / 2 else 0
    features['is_left_half'] = 1 if shot_end_x < GOAL_WIDTH / 2 else 0

    min_corner_dist = min(features['corner_distance_tl'], features['corner_distance_tr'],
                          features['corner_distance_bl'], features['corner_distance_br'])
    features['is_corner_shot'] = 1 if min_corner_dist < 1.5 else 0

    # Speed category
    if shot_speed < 60:
        features['speed_category'] = 0
    elif shot_speed < 80:
        features['speed_category'] = 1
    elif shot_speed < 100:
        features['speed_category'] = 2
    else:
        features['speed_category'] = 3

    # GK coverage ratio
    features['gk_coverage_ratio'] = features['gk_dive_distance'] / (features['ball_travel_time'] * 4 + 0.1)

    # Time margin
    gk_reach_time = features['gk_dive_distance'] / 4 + 0.15
    features['time_margin'] = features['ball_travel_time'] - gk_reach_time

    return features


def _calculate_physics_based(shot_end_x, shot_end_y, shot_speed, gk_x, gk_y, shot_distance):
    """Fallback physics-based PSxG calculation"""

    # Ball travel time
    ball_travel_time = _calculate_ball_travel_time(shot_speed, shot_distance)

    # GK reach time
    gk_reach_time = _calculate_gk_reach_time(gk_x, gk_y, shot_end_x, shot_end_y)

    # Total time GK needs
    total_gk_time = GK_REACTION_TIME + gk_reach_time

    # Time margin
    time_margin = ball_travel_time - total_gk_time

    # Base save probability from timing
    if time_margin > 0.15:
        timing_save_prob = 0.95
    elif time_margin > 0.05:
        timing_save_prob = 0.80
    elif time_margin > 0:
        timing_save_prob = 0.60
    elif time_margin > -0.05:
        timing_save_prob = 0.35
    elif time_margin > -0.10:
        timing_save_prob = 0.15
    elif time_margin > -0.15:
        timing_save_prob = 0.08
    else:
        timing_save_prob = 0.02

    # Corner penalty
    corner_penalty = 1.0
    if shot_end_y > 2.0:  # Top area
        if shot_end_x < 1.5 or shot_end_x > 5.82:
            corner_penalty = 0.4
        else:
            corner_penalty = 0.6
    elif shot_end_y < 0.4:  # Bottom area
        if shot_end_x < 1.0 or shot_end_x > 6.32:
            corner_penalty = 0.5
        else:
            corner_penalty = 0.7
    elif shot_end_x < 1.5 or shot_end_x > 5.82:  # Sides
        corner_penalty = 0.75

    save_prob = timing_save_prob * corner_penalty
    psxg = 1 - save_prob

    return max(0.01, min(0.99, psxg))


def _calculate_ball_travel_time(shot_speed_kmh, distance):
    """Calculate ball travel time in seconds"""
    shot_speed_ms = shot_speed_kmh / 3.6
    avg_speed = shot_speed_ms * 0.95  # 5% deceleration
    return distance / avg_speed


def _calculate_gk_reach_time(gk_x, gk_y, shot_end_x, shot_end_y):
    """Calculate time for GK to reach ball position"""

    horizontal_dist = abs(shot_end_x - gk_x)
    GK_ARM_REACH = 0.75
    GK_STANDING_REACH = 2.30

    # Vertical distance
    if shot_end_y <= GK_STANDING_REACH and horizontal_dist < 0.5:
        vertical_dist = 0
    else:
        vertical_dist = max(0, shot_end_y - GK_STANDING_REACH) if shot_end_y > 1.0 else max(0, 0.5 - shot_end_y)

    # Horizontal time
    if horizontal_dist <= GK_ARM_REACH:
        horizontal_time = 0.05
    else:
        horizontal_time = (horizontal_dist - GK_ARM_REACH) / GK_DIVE_SPEED_HORIZONTAL

    # Vertical time
    vertical_time = vertical_dist / GK_DIVE_SPEED_VERTICAL

    # Diagonal penalty
    diagonal_penalty = 1.1 if horizontal_dist > 1.0 and vertical_dist > 0.3 else 1.0

    return max(horizontal_time, vertical_time) * diagonal_penalty


def _get_zone(shot_end_x, shot_end_y):
    """Get zone name for shot placement"""

    # Horizontal
    if shot_end_x < GOAL_WIDTH / 3:
        h_zone = "L"
    elif shot_end_x > 2 * GOAL_WIDTH / 3:
        h_zone = "R"
    else:
        h_zone = "C"

    # Vertical
    if shot_end_y < GOAL_HEIGHT / 3:
        v_zone = "LOW"
    elif shot_end_y > 2 * GOAL_HEIGHT / 3:
        v_zone = "TOP"
    else:
        v_zone = "MID"

    return f"{v_zone}_{h_zone}"


def get_zone_psxg_map():
    """Get base PSxG values for each zone (for UI display)"""
    return {
        'TOP_L': 0.92,
        'TOP_C': 0.58,
        'TOP_R': 0.92,
        'MID_L': 0.65,
        'MID_C': 0.28,
        'MID_R': 0.65,
        'LOW_L': 0.48,
        'LOW_C': 0.18,
        'LOW_R': 0.48,
    }


# Test function
if __name__ == "__main__":
    print("Testing PSxG calculation...")
    print("=" * 50)

    # Test cases
    test_cases = [
        {"name": "Top left corner", "x": 0.5, "y": 2.2, "speed": 90, "gk_x": 3.66, "gk_y": 0},
        {"name": "Top right corner", "x": 6.8, "y": 2.2, "speed": 95, "gk_x": 3.66, "gk_y": 0},
        {"name": "Center low", "x": 3.66, "y": 0.3, "speed": 75, "gk_x": 3.66, "gk_y": 0},
        {"name": "Center middle", "x": 3.66, "y": 1.2, "speed": 80, "gk_x": 3.66, "gk_y": 0},
        {"name": "Bottom left corner", "x": 0.3, "y": 0.2, "speed": 85, "gk_x": 3.66, "gk_y": 0},
        {"name": "GK wrong-footed", "x": 6.5, "y": 1.0, "speed": 80, "gk_x": 1.5, "gk_y": 0},
    ]

    for tc in test_cases:
        result = calculate_psxg(tc['x'], tc['y'], tc['speed'], tc['gk_x'], tc['gk_y'])
        print(f"\n{tc['name']}:")
        print(f"  Shot to: ({tc['x']}, {tc['y']}) at {tc['speed']} km/h")
        print(f"  GK at: ({tc['gk_x']}, {tc['gk_y']})")
        print(f"  PSxG: {result['psxg']} ({result['psxg']*100:.1f}%)")
        print(f"  Zone: {result['zone']}")
        print(f"  Save Difficulty: {result['save_difficulty']}")
        print(f"  GK Dive Distance: {result['gk_dive_distance']}m")
