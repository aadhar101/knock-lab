"""
Train ULTIMATE xG Model with ALL Available Features
Includes: Shot power, placement, pressure, first touch, score diff, all 8 defenders, advanced spatial
"""
import pickle
import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report
import warnings
warnings.filterwarnings('ignore')

print("=" * 70)
print("TRAINING ULTIMATE XG MODEL WITH ALL FEATURES")
print("=" * 70)

# Load dataset
print("\nLoading 500k shots dataset...")
df = pd.read_csv('premier_league_xg_dataset_large_new.csv')
print(f"[OK] Loaded {len(df):,} shots")

# Handle goal_scored
if df['goal_scored'].dtype == 'object':
    df['goal_scored'] = df['goal_scored'].str.upper().str.strip() == 'TRUE'

print(f"   Original goal rate: {df['goal_scored'].mean():.4f}")

# ===== STRATEGIC GK POSITIONING AUGMENTATION =====
# Add extreme GK positioning scenarios to teach the model about tap-ins
print("\n[CONFIG] Adding strategic GK positioning scenarios...")

# Create tap-in scenarios with GK out of position
close_shots = df[df['distance_to_goal'] <= 5].copy()
if len(close_shots) > 0:
    # Scenario 1: GK way off to one side (should be near 100% goal)
    tapin_1 = close_shots.sample(min(5000, len(close_shots)), replace=True).copy()
    tapin_1['gk_y'] = tapin_1['gk_y'] + np.random.uniform(15, 20, len(tapin_1))  # GK 15-20m off center
    tapin_1['goal_scored'] = True  # Almost always a goal

    # Scenario 2: GK too far forward or backward
    tapin_2 = close_shots.sample(min(5000, len(close_shots)), replace=True).copy()
    tapin_2['gk_x'] = tapin_2['gk_x'] - np.random.uniform(5, 10, len(tapin_2))  # GK too far out
    tapin_2['goal_scored'] = np.random.random(len(tapin_2)) < 0.95  # 95% goal rate

    # Combine with original data
    df = pd.concat([df, tapin_1, tapin_2], ignore_index=True)
    print(f"   Added {len(tapin_1) + len(tapin_2):,} tap-in scenarios")
    print(f"   New dataset size: {len(df):,} shots")
    print(f"   New goal rate: {df['goal_scored'].mean():.4f}")

print("\n[CONFIG] Engineering NEW features...")

# ===== BASIC FEATURES =====
df['distance_to_goal'] = np.sqrt((df['x_coord'] - 105)**2 + (df['y_coord'] - 34)**2)
df['angle_to_goal'] = np.degrees(np.arctan2(7.32, 105 - df['x_coord'] + 0.1))
df['center_distance'] = np.abs(df['y_coord'] - 34)

# ===== GK FEATURES =====
print("   [GOAL] GK positioning features...")
df['gk_distance'] = np.sqrt((df['x_coord'] - df['gk_x'])**2 + (df['y_coord'] - df['gk_y'])**2)
df['gk_off_center'] = np.abs(df['gk_y'] - 34)
df['gk_advanced'] = np.clip(105 - df['gk_x'], 0, 30) / 30
df['gk_to_goal_dist'] = np.sqrt((df['gk_x'] - 105)**2 + (df['gk_y'] - 34)**2)
df['gk_angle_to_shot'] = np.degrees(np.arctan2(df['y_coord'] - df['gk_y'], df['x_coord'] - df['gk_x']))
df['gk_coverage_angle'] = np.degrees(np.arctan2(3.66, df['gk_to_goal_dist'] + 0.1))
df['gk_shot_line_distance'] = np.abs(
    (df['y_coord'] - 34) * (105 - df['gk_x']) - (df['x_coord'] - 105) * (df['gk_y'] - 34)
) / np.sqrt((df['y_coord'] - 34)**2 + (df['x_coord'] - 105)**2 + 0.1)

# ===== NEW: SHOT POWER & PLACEMENT =====
print("   [POWER] Shot power & placement features...")
df['normalized_shot_power'] = (df['shot_power'] - 50) / 50
df['normalized_shot_placement'] = df['shot_placement'] / 10
df['shot_quality_score'] = df['normalized_shot_power'] * df['normalized_shot_placement']
df['power_distance_interaction'] = df['shot_power'] / (df['distance_to_goal'] + 1)
df['placement_gk_interaction'] = df['shot_placement'] * df['gk_coverage_angle']
df['power_category_weak'] = (df['shot_power'] < 65).astype(int)
df['power_category_strong'] = (df['shot_power'] > 85).astype(int)
df['placement_category_good'] = (df['shot_placement'] > 7).astype(int)

# ===== NEW: PRESSURE & FIRST TOUCH =====
print("   [TARGET] Pressure & first touch features...")
df['is_first_touch'] = df['first_touch'].fillna(False).astype(int)
df['is_under_pressure'] = df['under_pressure'].fillna(False).astype(int)
df['first_touch_difficulty'] = df['is_first_touch'] * df['distance_to_goal']
df['pressure_distance_interaction'] = df['is_under_pressure'] * df['distance_to_goal']
df['pressure_angle_reduction'] = df['is_under_pressure'] * (90 - df['angle_to_goal'])
df['quality_under_pressure'] = df['shot_quality_score'] * (1 - df['is_under_pressure'] * 0.3)
df['first_touch_quality'] = df['is_first_touch'] * df['distance_to_goal'] * df['is_under_pressure']

# ===== NEW: GAME STATE =====
print("   [STATS] Game state features...")
df['match_score_diff'] = df['match_score_diff'].fillna(0)
df['is_losing'] = (df['match_score_diff'] < 0).astype(int)
df['is_winning'] = (df['match_score_diff'] > 0).astype(int)
df['is_drawing'] = (df['match_score_diff'] == 0).astype(int)
df['desperation_factor'] = np.where(
    (df['match_score_diff'] < 0) & (df['match_minute'] >= 75),
    1.5,
    1.0
)
df['score_time_interaction'] = df['match_score_diff'] * df['match_minute']
df['is_second_half'] = (~df['is_first_half'].fillna(True)).astype(int)
df['half_minute'] = np.where(df['is_first_half'].fillna(True), df['match_minute'], df['match_minute'] - 45)

# ===== ALL 8 DEFENDERS =====
print("   [DEFENSE] Processing ALL 8 defenders...")
for i in range(1, 9):
    def_x = f'def{i}_x'
    def_y = f'def{i}_y'

    if def_x in df.columns:
        df[f'def{i}_distance'] = np.sqrt((df['x_coord'] - df[def_x])**2 + (df['y_coord'] - df[def_y])**2)
        df[f'def{i}_blocking'] = (
            (df[def_x] > df['x_coord']) &
            (df[def_x] < 105) &
            (np.abs(df[def_y] - 34) < 10)
        ).astype(int)
        df[f'def{i}_very_close'] = (df[f'def{i}_distance'] <= 2).astype(int)
        df[f'def{i}_close'] = (df[f'def{i}_distance'] <= 3.5).astype(int)

# Aggregate defender features
print("   [CHART] Aggregate defender metrics...")
df['defenders_very_close'] = sum(df[f'def{i}_very_close'] for i in range(1, 9) if f'def{i}_very_close' in df.columns)
df['defenders_close'] = sum(df[f'def{i}_close'] for i in range(1, 9) if f'def{i}_close' in df.columns)
df['defenders_blocking'] = sum(df[f'def{i}_blocking'] for i in range(1, 9) if f'def{i}_blocking' in df.columns)

# Defensive depth & compactness
defender_distances = [df[f'def{i}_distance'] for i in range(1, 9) if f'def{i}_distance' in df.columns]
if defender_distances:
    df['closest_defender_dist'] = pd.concat(defender_distances, axis=1).min(axis=1)
    df['avg_closest_3_defenders'] = pd.concat(defender_distances, axis=1).apply(lambda x: x.nsmallest(3).mean(), axis=1)
    df['defensive_compactness'] = pd.concat(defender_distances, axis=1).std(axis=1).fillna(0)
    df['second_line_defenders'] = sum(
        ((df[f'def{i}_distance'] > 5) & (df[f'def{i}_distance'] < 10)).astype(int)
        for i in range(1, 9) if f'def{i}_distance' in df.columns
    )

# Corridor defenders
df['corridor_defenders'] = 0
for i in range(1, 9):
    if f'def{i}_x' in df.columns:
        in_corridor = (
            (df[f'def{i}_x'] > df['x_coord']) &
            (df[f'def{i}_x'] < 105) &
            (np.abs(df[f'def{i}_y'] - df['y_coord']) < 5)
        )
        df['corridor_defenders'] += in_corridor.astype(int)

# ===== ADVANCED SPATIAL FEATURES =====
print("   [GLOBAL] Advanced spatial features...")
df['shooting_lane_width'] = df['angle_to_goal'] / (df['defenders_blocking'] + 1)
df['effective_goal_size'] = 7.32 * (1 - np.clip(df['defenders_blocking'] / 5, 0, 0.8))

# ===== OTHER FEATURES =====
df['is_header'] = (df['body_part'].str.upper() == 'HEAD').astype(int)
df['distance_angle_interaction'] = df['distance_to_goal'] * (90 - df['angle_to_goal']) / 90
df['is_close_shot'] = (df['distance_to_goal'] <= 15).astype(int)
df['is_central'] = (df['center_distance'] <= 8).astype(int)
df['clear_path'] = (df['defenders_close'] == 0).astype(int)

# Mathematical features
df['log_distance'] = np.log1p(df['distance_to_goal'])
df['sin_angle'] = np.sin(np.radians(df['angle_to_goal']))
df['cos_angle'] = np.cos(np.radians(df['angle_to_goal']))
df['shot_difficulty'] = df['distance_to_goal'] / (df['angle_to_goal'] + 1)

# Time features
df['minute'] = df['match_minute'].fillna(45)
df['is_late_game'] = (df['minute'] >= 75).astype(int)
df['is_injury_time'] = (df['minute'] >= 90).astype(int)
df['fatigue_factor'] = np.clip(df['minute'] / 90, 0, 1)

# ===== COMBINATION FEATURES =====
print("   [LINK] Combination features...")
df['gk_challenge_difficulty'] = df['shot_power'] * df['shot_placement'] * df['gk_coverage_angle']
df['desperation_shot'] = df['is_losing'] * (df['minute'] > 80).astype(int) * df['is_under_pressure']
df['gk_defender_interaction'] = df['gk_to_goal_dist'] * df['defenders_blocking']
df['gk_distance_shot_difficulty'] = df['gk_distance'] * df['shot_difficulty']

# ===== SELECT FEATURES =====
features = [
    # Position
    'x_coord', 'y_coord', 'distance_to_goal', 'angle_to_goal', 'center_distance',

    # GK (9 features)
    'gk_x', 'gk_y', 'gk_distance', 'gk_off_center', 'gk_advanced',
    'gk_to_goal_dist', 'gk_angle_to_shot', 'gk_coverage_angle', 'gk_shot_line_distance',

    # NEW: Shot Quality (9 features)
    'shot_power', 'shot_placement', 'normalized_shot_power', 'normalized_shot_placement',
    'shot_quality_score', 'power_distance_interaction', 'placement_gk_interaction',
    'power_category_weak', 'power_category_strong', 'placement_category_good',

    # NEW: Pressure & First Touch (7 features)
    'is_first_touch', 'is_under_pressure', 'first_touch_difficulty',
    'pressure_distance_interaction', 'pressure_angle_reduction',
    'quality_under_pressure', 'first_touch_quality',

    # NEW: Game State (9 features)
    'match_score_diff', 'is_losing', 'is_winning', 'is_drawing',
    'desperation_factor', 'score_time_interaction', 'is_second_half', 'half_minute',
    'is_first_half',

    # Defenders - ALL 8 (32 features = 8 defenders × 4 metrics)
    'def1_x', 'def1_y', 'def1_distance', 'def1_blocking',
    'def2_x', 'def2_y', 'def2_distance', 'def2_blocking',
    'def3_x', 'def3_y', 'def3_distance', 'def3_blocking',
    'def4_x', 'def4_y', 'def4_distance', 'def4_blocking',
    'def5_x', 'def5_y', 'def5_distance', 'def5_blocking',
    'def6_x', 'def6_y', 'def6_distance', 'def6_blocking',
    'def7_x', 'def7_y', 'def7_distance', 'def7_blocking',
    'def8_x', 'def8_y', 'def8_distance', 'def8_blocking',

    # Aggregate defenders (7 features)
    'defenders_very_close', 'defenders_close', 'defenders_blocking',
    'closest_defender_dist', 'avg_closest_3_defenders', 'corridor_defenders',
    'defensive_compactness', 'second_line_defenders',

    # Shot characteristics
    'is_header', 'distance_angle_interaction', 'is_close_shot', 'is_central',
    'clear_path', 'shooting_lane_width', 'effective_goal_size',

    # Mathematical
    'log_distance', 'sin_angle', 'cos_angle', 'shot_difficulty',

    # Time
    'minute', 'is_late_game', 'is_injury_time', 'fatigue_factor',

    # Combination features
    'gk_challenge_difficulty', 'desperation_shot',
    'gk_defender_interaction', 'gk_distance_shot_difficulty'
]

# Remove features that don't exist
features = [f for f in features if f in df.columns]

print(f"\n[CHART] ULTIMATE MODEL FEATURES: {len(features)}")
print(f"   • Position: 5")
print(f"   • GK: 9")
print(f"   • Shot Quality (NEW): 10")
print(f"   • Pressure/First Touch (NEW): 7")
print(f"   • Game State (NEW): 9")
print(f"   • Individual Defenders: 32 (all 8 defenders)")
print(f"   • Aggregate Defenders: 8")
print(f"   • Shot Characteristics: 7")
print(f"   • Mathematical: 4")
print(f"   • Time: 4")
print(f"   • Combinations: 4")

X = df[features].fillna(0)
y = df['goal_scored']

print(f"\n[STATS] Dataset: {len(df):,} shots, {y.sum():,} goals ({y.mean():.1%} conversion)")

# Use ALL 500,000 samples: 400k training, 100k testing
print(f"\n[DOWN] Using all {len(df):,} shots for training...")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"[REFRESH] Train/Test split: {len(X_train):,} / {len(X_test):,}")

# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train Ultimate XGBoost
print("\n[TRAIN] Training ULTIMATE XGBoost model...")

xgb_params = {
    'objective': 'binary:logistic',
    'eval_metric': 'logloss',
    'max_depth': 12,
    'learning_rate': 0.02,
    'n_estimators': 800,
    'subsample': 0.8,
    'colsample_bytree': 0.6,
    'gamma': 2.0,
    'reg_alpha': 0.25,
    'reg_lambda': 2.5,
    'min_child_weight': 35,
    'scale_pos_weight': len(y_train[y_train==0]) / len(y_train[y_train==1]),
    'random_state': 42,
    'n_jobs': -1,
    'tree_method': 'hist'
}

model = xgb.XGBClassifier(**xgb_params)
eval_set = [(X_train_scaled, y_train), (X_test_scaled, y_test)]
model.fit(X_train_scaled, y_train, eval_set=eval_set, verbose=False)

# Evaluate
y_pred = model.predict(X_test_scaled)
y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]

accuracy = accuracy_score(y_test, y_pred)
roc_auc = roc_auc_score(y_test, y_pred_proba)

print(f"\n[STATS] ULTIMATE Model Performance:")
print(f"   Accuracy: {accuracy:.4f}")
print(f"   ROC-AUC: {roc_auc:.4f}")

print("\n[LIST] Classification Report:")
print(classification_report(y_test, y_pred, target_names=['No Goal', 'Goal'], digits=3))

# Feature importance by category
print("\n[SEARCH] Top 25 Feature Importance:")
importance = model.feature_importances_
indices = np.argsort(importance)[::-1][:25]
for i, idx in enumerate(indices):
    print(f"   {i+1:2}. {features[idx]:35s}: {importance[idx]:.4f}")

# Category analysis
print(f"\n[STATS] Feature Importance by Category:")
categories = {
    'Shot Quality (NEW)': [f for f in features if any(x in f for x in ['power', 'placement', 'quality'])],
    'Pressure/Touch (NEW)': [f for f in features if any(x in f for x in ['first_touch', 'pressure'])],
    'Game State (NEW)': [f for f in features if any(x in f for x in ['score', 'losing', 'winning', 'desperation', 'half'])],
    'GK Features': [f for f in features if 'gk' in f.lower()],
    'Defender Features': [f for f in features if 'def' in f or 'defender' in f],
}

for cat, feats in categories.items():
    if feats:
        cat_importance = sum(importance[features.index(f)] for f in feats if f in features)
        print(f"   {cat:25s}: {len(feats):2} features ({cat_importance*100:5.1f}% importance)")

# Save model
print("\n[SAVE] Saving ULTIMATE model...")
with open('ultimate_xg_model.pkl', 'wb') as f:
    pickle.dump(model, f)
with open('ultimate_xg_scaler.pkl', 'wb') as f:
    pickle.dump(scaler, f)
with open('ultimate_xg_features.pkl', 'wb') as f:
    pickle.dump(features, f)

print("[OK] ULTIMATE model saved successfully!")
print(f"   • ultimate_xg_model.pkl")
print(f"   • ultimate_xg_scaler.pkl")
print(f"   • ultimate_xg_features.pkl")

print("\n[STAR] ULTIMATE Model Improvements:")
print("   [OK] Shot power & placement (quality scoring)")
print("   [OK] First touch & pressure context")
print("   [OK] Game state (score differential, urgency)")
print("   [OK] ALL 8 defenders (full defensive picture)")
print("   [OK] Advanced spatial features")
print(f"   [OK] {len(features)} total features (up from 53)")
print(f"   [OK] ROC-AUC: {roc_auc:.4f}")
