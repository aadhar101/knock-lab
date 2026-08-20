"""
Synthetic PSxG (Post-Shot Expected Goals) Data Generator
Generates 1 million realistic training samples based on physics and goalkeeper biomechanics

Key factors modeled:
1. Shot placement in goal frame (corners harder to save)
2. Shot speed (faster = less reaction time)
3. Goalkeeper position and dive capabilities
4. Realistic biomechanical constraints (dive speed, reach, reaction time)
"""

import numpy as np
import pandas as pd
from tqdm import tqdm
import os

# Constants - Goal dimensions (in meters)
GOAL_WIDTH = 7.32  # Standard goal width
GOAL_HEIGHT = 2.44  # Standard goal height
GOAL_CENTER_X = GOAL_WIDTH / 2  # 3.66m
GOAL_CENTER_Y = GOAL_HEIGHT / 2  # 1.22m

# Goalkeeper biomechanics (based on research)
GK_STANDING_HEIGHT = 1.85  # Average GK height
GK_ARM_REACH = 0.75  # Arm reach when diving
GK_STANDING_REACH_HEIGHT = 2.30  # Max reach when standing (jump + arm)
GK_DIVE_SPEED_HORIZONTAL = 4.0  # m/s horizontal dive speed
GK_DIVE_SPEED_VERTICAL = 2.5  # m/s vertical dive/jump speed
GK_REACTION_TIME_BASE = 0.15  # Base reaction time in seconds
GK_REACTION_TIME_VARIANCE = 0.05  # Variance in reaction time

# Shot characteristics
MIN_SHOT_SPEED = 40  # km/h (weak shot)
MAX_SHOT_SPEED = 130  # km/h (powerful shot)
AVERAGE_SHOT_DISTANCE = 15  # meters from goal (for reaction time calc)

def calculate_gk_reach_time(gk_x, gk_y, shot_end_x, shot_end_y):
    """
    Calculate time needed for GK to reach the ball position
    Considers horizontal dive and vertical jump/dive
    """
    # Horizontal distance to cover
    horizontal_dist = abs(shot_end_x - gk_x)

    # Vertical distance to cover
    # GK can reach up to standing_reach_height without diving
    if shot_end_y <= GK_STANDING_REACH_HEIGHT and horizontal_dist < 0.5:
        vertical_dist = 0  # Can reach without diving vertically
    else:
        vertical_dist = max(0, shot_end_y - GK_STANDING_REACH_HEIGHT) if shot_end_y > 1.0 else max(0, 0.5 - shot_end_y)

    # Time to cover horizontal distance
    if horizontal_dist <= GK_ARM_REACH:
        horizontal_time = 0.05  # Just arm reach
    else:
        horizontal_time = (horizontal_dist - GK_ARM_REACH) / GK_DIVE_SPEED_HORIZONTAL

    # Time to cover vertical distance
    vertical_time = vertical_dist / GK_DIVE_SPEED_VERTICAL

    # Total time is the max of both (dive is diagonal but limited by slower component)
    # Add some penalty for coordinating diagonal dive
    diagonal_penalty = 1.1 if horizontal_dist > 1.0 and vertical_dist > 0.3 else 1.0

    return max(horizontal_time, vertical_time) * diagonal_penalty


def calculate_ball_travel_time(shot_speed_kmh, distance_to_goal):
    """
    Calculate time for ball to reach goal
    Shot speed decays slightly over distance
    """
    shot_speed_ms = shot_speed_kmh / 3.6  # Convert to m/s
    # Simple model: slight deceleration
    avg_speed = shot_speed_ms * 0.95  # 5% speed loss
    return distance_to_goal / avg_speed


def calculate_save_probability(gk_reach_time, ball_travel_time, reaction_time, shot_end_x, shot_end_y):
    """
    Calculate probability of save based on timing and positioning
    """
    # Total time GK needs
    total_gk_time = reaction_time + gk_reach_time

    # Time margin (positive = GK has time, negative = ball arrives first)
    time_margin = ball_travel_time - total_gk_time

    # Base save probability from timing
    if time_margin > 0.15:
        # GK has plenty of time
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

    # Positional difficulty modifier
    # Corners are harder even if GK gets there (awkward save)
    corner_penalty = 1.0

    # Top corners (y > 2.0m)
    if shot_end_y > 2.0:
        if shot_end_x < 1.5 or shot_end_x > 5.82:  # Within 1.5m of posts
            corner_penalty = 0.4  # Very hard to save even if reached
        else:
            corner_penalty = 0.6
    # Bottom corners (y < 0.4m)
    elif shot_end_y < 0.4:
        if shot_end_x < 1.0 or shot_end_x > 6.32:
            corner_penalty = 0.5  # Hard to get down quickly
        else:
            corner_penalty = 0.7
    # Side areas
    elif shot_end_x < 1.5 or shot_end_x > 5.82:
        corner_penalty = 0.75

    # Final save probability
    save_prob = timing_save_prob * corner_penalty

    return min(0.98, max(0.01, save_prob))


def get_zone(shot_end_x, shot_end_y):
    """
    Categorize shot into zones for analysis
    """
    # Horizontal zones
    if shot_end_x < GOAL_WIDTH / 3:
        h_zone = "L"
    elif shot_end_x > 2 * GOAL_WIDTH / 3:
        h_zone = "R"
    else:
        h_zone = "C"

    # Vertical zones
    if shot_end_y < GOAL_HEIGHT / 3:
        v_zone = "LOW"
    elif shot_end_y > 2 * GOAL_HEIGHT / 3:
        v_zone = "TOP"
    else:
        v_zone = "MID"

    return f"{v_zone}_{h_zone}"


def generate_realistic_gk_position():
    """
    Generate realistic GK starting position
    GKs typically position themselves based on the shot angle
    """
    # GK usually stays near center but can be off-center
    gk_x = np.random.normal(GOAL_CENTER_X, 0.8)  # Centered with some variance
    gk_x = np.clip(gk_x, 1.0, 6.32)  # Stay within reasonable bounds

    # GK vertical position (usually on ground or slightly set)
    gk_y = np.random.choice([0.0, 0.3, 0.5], p=[0.6, 0.3, 0.1])

    return gk_x, gk_y


def generate_shot_end_position():
    """
    Generate realistic shot end positions
    Real shots cluster in certain areas (not uniform)
    """
    # Decide shot type
    shot_type = np.random.choice(
        ['aimed_corner', 'aimed_side', 'central', 'wild'],
        p=[0.25, 0.35, 0.30, 0.10]
    )

    if shot_type == 'aimed_corner':
        # Aimed at corners - top or bottom
        corner = np.random.choice(['top_left', 'top_right', 'bottom_left', 'bottom_right'])
        if corner == 'top_left':
            x = np.random.normal(0.8, 0.4)
            y = np.random.normal(2.1, 0.25)
        elif corner == 'top_right':
            x = np.random.normal(6.52, 0.4)
            y = np.random.normal(2.1, 0.25)
        elif corner == 'bottom_left':
            x = np.random.normal(0.6, 0.35)
            y = np.random.normal(0.3, 0.2)
        else:  # bottom_right
            x = np.random.normal(6.72, 0.35)
            y = np.random.normal(0.3, 0.2)

    elif shot_type == 'aimed_side':
        # Aimed at sides but not corners
        side = np.random.choice(['left', 'right'])
        if side == 'left':
            x = np.random.normal(1.5, 0.6)
        else:
            x = np.random.normal(5.82, 0.6)
        y = np.random.normal(1.0, 0.5)

    elif shot_type == 'central':
        # Central shots (often from headers or quick shots)
        x = np.random.normal(GOAL_CENTER_X, 1.2)
        y = np.random.normal(1.0, 0.6)

    else:  # wild
        # Wild shots - more random
        x = np.random.uniform(0, GOAL_WIDTH)
        y = np.random.uniform(0, GOAL_HEIGHT)

    # Clip to goal dimensions
    x = np.clip(x, 0.05, GOAL_WIDTH - 0.05)
    y = np.clip(y, 0.05, GOAL_HEIGHT - 0.05)

    return x, y


def generate_shot_speed():
    """
    Generate realistic shot speeds
    Distribution based on typical shot power
    """
    # Mix of different shot types
    shot_power_type = np.random.choice(
        ['weak', 'normal', 'powerful', 'thunderbolt'],
        p=[0.15, 0.45, 0.30, 0.10]
    )

    if shot_power_type == 'weak':
        speed = np.random.normal(55, 8)
    elif shot_power_type == 'normal':
        speed = np.random.normal(75, 10)
    elif shot_power_type == 'powerful':
        speed = np.random.normal(95, 8)
    else:  # thunderbolt
        speed = np.random.normal(115, 10)

    return np.clip(speed, MIN_SHOT_SPEED, MAX_SHOT_SPEED)


def generate_shot_distance():
    """
    Generate distance from which shot was taken
    Affects ball travel time
    """
    # Most shots from 8-25m
    distance = np.random.exponential(12) + 5
    return np.clip(distance, 5, 40)


def generate_single_sample():
    """
    Generate a single PSxG training sample
    """
    # Generate shot characteristics
    shot_end_x, shot_end_y = generate_shot_end_position()
    shot_speed = generate_shot_speed()
    shot_distance = generate_shot_distance()

    # Generate GK position
    gk_x, gk_y = generate_realistic_gk_position()

    # Add some GK positioning bias based on where shots tend to go
    # (GKs anticipate)
    anticipation = np.random.uniform(0, 0.3)
    if shot_end_x < GOAL_CENTER_X:
        gk_x -= anticipation
    else:
        gk_x += anticipation
    gk_x = np.clip(gk_x, 0.5, 6.82)

    # Calculate physics
    ball_travel_time = calculate_ball_travel_time(shot_speed, shot_distance)
    reaction_time = GK_REACTION_TIME_BASE + np.random.normal(0, GK_REACTION_TIME_VARIANCE)
    reaction_time = max(0.08, reaction_time)  # Min reaction time

    gk_reach_time = calculate_gk_reach_time(gk_x, gk_y, shot_end_x, shot_end_y)

    # Calculate save probability
    save_prob = calculate_save_probability(
        gk_reach_time, ball_travel_time, reaction_time, shot_end_x, shot_end_y
    )

    # Determine if goal (PSxG = 1 - save_prob)
    psxg = 1 - save_prob
    is_goal = np.random.random() < psxg

    # Calculate derived features
    gk_dive_distance = np.sqrt((shot_end_x - gk_x)**2 + (shot_end_y - gk_y)**2)
    dist_from_center = np.sqrt((shot_end_x - GOAL_CENTER_X)**2 + (shot_end_y - GOAL_CENTER_Y)**2)

    # Zone classification
    zone = get_zone(shot_end_x, shot_end_y)

    return {
        'shot_end_x': round(shot_end_x, 3),
        'shot_end_y': round(shot_end_y, 3),
        'shot_speed': round(shot_speed, 1),
        'shot_distance': round(shot_distance, 1),
        'gk_x': round(gk_x, 3),
        'gk_y': round(gk_y, 3),
        'gk_dive_distance': round(gk_dive_distance, 3),
        'ball_travel_time': round(ball_travel_time, 4),
        'gk_reach_time': round(gk_reach_time, 4),
        'reaction_time': round(reaction_time, 4),
        'dist_from_center': round(dist_from_center, 3),
        'dist_from_left_post': round(shot_end_x, 3),
        'dist_from_right_post': round(GOAL_WIDTH - shot_end_x, 3),
        'dist_from_crossbar': round(GOAL_HEIGHT - shot_end_y, 3),
        'dist_from_ground': round(shot_end_y, 3),
        'zone': zone,
        'psxg': round(psxg, 4),
        'is_goal': int(is_goal)
    }


def generate_dataset(n_samples, batch_size=100000):
    """
    Generate the full dataset in batches
    """
    print(f"Generating {n_samples:,} synthetic PSxG samples...")
    print("=" * 60)

    all_data = []
    n_batches = (n_samples + batch_size - 1) // batch_size

    for batch in range(n_batches):
        batch_start = batch * batch_size
        batch_end = min((batch + 1) * batch_size, n_samples)
        batch_samples = batch_end - batch_start

        print(f"\nBatch {batch + 1}/{n_batches}: Generating {batch_samples:,} samples...")

        batch_data = []
        for _ in tqdm(range(batch_samples), desc=f"Batch {batch + 1}"):
            sample = generate_single_sample()
            batch_data.append(sample)

        all_data.extend(batch_data)

        # Progress report
        goals = sum(1 for s in batch_data if s['is_goal'])
        goal_rate = goals / batch_samples * 100
        avg_psxg = sum(s['psxg'] for s in batch_data) / batch_samples
        print(f"  Goal rate: {goal_rate:.1f}% | Avg PSxG: {avg_psxg:.3f}")

    return all_data


def analyze_dataset(df):
    """
    Print dataset statistics
    """
    print("\n" + "=" * 60)
    print("DATASET ANALYSIS")
    print("=" * 60)

    print(f"\nTotal samples: {len(df):,}")
    print(f"Goals: {df['is_goal'].sum():,} ({df['is_goal'].mean()*100:.1f}%)")
    print(f"Saves: {(1-df['is_goal']).sum():,} ({(1-df['is_goal'].mean())*100:.1f}%)")

    print(f"\nPSxG Statistics:")
    print(f"  Mean: {df['psxg'].mean():.3f}")
    print(f"  Std:  {df['psxg'].std():.3f}")
    print(f"  Min:  {df['psxg'].min():.3f}")
    print(f"  Max:  {df['psxg'].max():.3f}")

    print(f"\nShot Speed Statistics:")
    print(f"  Mean: {df['shot_speed'].mean():.1f} km/h")
    print(f"  Min:  {df['shot_speed'].min():.1f} km/h")
    print(f"  Max:  {df['shot_speed'].max():.1f} km/h")

    print(f"\nGK Dive Distance Statistics:")
    print(f"  Mean: {df['gk_dive_distance'].mean():.2f}m")
    print(f"  Max:  {df['gk_dive_distance'].max():.2f}m")

    print(f"\nGoal Rate by Zone:")
    zone_stats = df.groupby('zone').agg({
        'is_goal': ['count', 'mean'],
        'psxg': 'mean'
    }).round(3)
    zone_stats.columns = ['count', 'goal_rate', 'avg_psxg']
    zone_stats = zone_stats.sort_values('avg_psxg', ascending=False)
    print(zone_stats.to_string())

    print(f"\nCorrelations with is_goal:")
    numeric_cols = ['shot_end_x', 'shot_end_y', 'shot_speed', 'gk_dive_distance',
                   'dist_from_center', 'ball_travel_time']
    for col in numeric_cols:
        corr = df[col].corr(df['is_goal'])
        print(f"  {col}: {corr:.3f}")


def main():
    # Set random seed for reproducibility
    np.random.seed(42)

    # Generate 1 million samples
    N_SAMPLES = 1_000_000

    print("=" * 60)
    print("PSxG SYNTHETIC DATA GENERATOR")
    print("=" * 60)
    print(f"Target: {N_SAMPLES:,} samples")
    print(f"Goal dimensions: {GOAL_WIDTH}m x {GOAL_HEIGHT}m")
    print("=" * 60)

    # Generate data
    data = generate_dataset(N_SAMPLES)

    # Convert to DataFrame
    print("\nConverting to DataFrame...")
    df = pd.DataFrame(data)

    # Analyze
    analyze_dataset(df)

    # Save to CSV
    output_path = 'psxg_synthetic_data_1m.csv'
    print(f"\nSaving to {output_path}...")
    df.to_csv(output_path, index=False)

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"Saved! File size: {file_size:.1f} MB")

    # Also save a small sample for quick testing
    sample_path = 'psxg_synthetic_data_sample.csv'
    df.head(10000).to_csv(sample_path, index=False)
    print(f"Saved sample (10k rows) to {sample_path}")

    print("\n" + "=" * 60)
    print("DATA GENERATION COMPLETE!")
    print("=" * 60)

    return df


if __name__ == "__main__":
    main()
