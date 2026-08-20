"""
Train PSxG (Post-Shot Expected Goals) Model
Uses XGBoost classifier trained on 1 million synthetic samples
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
import xgboost as xgb
import pickle
import os

# Feature columns for the model
FEATURE_COLUMNS = [
    'shot_end_x',
    'shot_end_y',
    'shot_speed',
    'shot_distance',
    'gk_x',
    'gk_y',
    'gk_dive_distance',
    'ball_travel_time',
    'dist_from_center',
    'dist_from_left_post',
    'dist_from_right_post',
    'dist_from_crossbar',
    'dist_from_ground',
]

# Derived features to add
DERIVED_FEATURES = [
    'shot_end_x_normalized',
    'shot_end_y_normalized',
    'gk_offset_x',
    'gk_offset_y',
    'corner_distance_tl',
    'corner_distance_tr',
    'corner_distance_bl',
    'corner_distance_br',
    'is_top_half',
    'is_left_half',
    'is_corner_shot',
    'speed_category',
    'gk_coverage_ratio',
    'time_margin',
]

GOAL_WIDTH = 7.32
GOAL_HEIGHT = 2.44


def add_derived_features(df):
    """Add engineered features for better model performance"""

    # Normalized positions (0-1 scale)
    df['shot_end_x_normalized'] = df['shot_end_x'] / GOAL_WIDTH
    df['shot_end_y_normalized'] = df['shot_end_y'] / GOAL_HEIGHT

    # GK offset from shot position
    df['gk_offset_x'] = df['shot_end_x'] - df['gk_x']
    df['gk_offset_y'] = df['shot_end_y'] - df['gk_y']

    # Distance to each corner
    df['corner_distance_tl'] = np.sqrt(df['shot_end_x']**2 + (GOAL_HEIGHT - df['shot_end_y'])**2)
    df['corner_distance_tr'] = np.sqrt((GOAL_WIDTH - df['shot_end_x'])**2 + (GOAL_HEIGHT - df['shot_end_y'])**2)
    df['corner_distance_bl'] = np.sqrt(df['shot_end_x']**2 + df['shot_end_y']**2)
    df['corner_distance_br'] = np.sqrt((GOAL_WIDTH - df['shot_end_x'])**2 + df['shot_end_y']**2)

    # Binary features
    df['is_top_half'] = (df['shot_end_y'] > GOAL_HEIGHT / 2).astype(int)
    df['is_left_half'] = (df['shot_end_x'] < GOAL_WIDTH / 2).astype(int)

    # Corner shot (within 1.5m of any corner)
    min_corner_dist = df[['corner_distance_tl', 'corner_distance_tr',
                          'corner_distance_bl', 'corner_distance_br']].min(axis=1)
    df['is_corner_shot'] = (min_corner_dist < 1.5).astype(int)

    # Speed category
    df['speed_category'] = pd.cut(df['shot_speed'],
                                   bins=[0, 60, 80, 100, 150],
                                   labels=[0, 1, 2, 3]).astype(int)

    # GK coverage ratio (how much of dive distance vs available time)
    df['gk_coverage_ratio'] = df['gk_dive_distance'] / (df['ball_travel_time'] * 4 + 0.1)

    # Time margin (ball travel time - estimated GK reach time)
    df['time_margin'] = df['ball_travel_time'] - (df['gk_dive_distance'] / 4 + 0.15)

    return df


def load_and_prepare_data(filepath):
    """Load data and prepare features"""
    print(f"Loading data from {filepath}...")
    df = pd.read_csv(filepath)
    print(f"Loaded {len(df):,} samples")

    # Add derived features
    print("Engineering derived features...")
    df = add_derived_features(df)

    # Get all feature columns
    all_features = FEATURE_COLUMNS + DERIVED_FEATURES

    X = df[all_features]
    y = df['is_goal']

    print(f"Features: {len(all_features)}")
    print(f"Target distribution: {y.value_counts().to_dict()}")

    return X, y, all_features


def train_model(X, y, feature_names):
    """Train XGBoost model"""

    # Split data
    print("\nSplitting data (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Training samples: {len(X_train):,}")
    print(f"Test samples: {len(X_test):,}")

    # Scale features
    print("\nScaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train XGBoost
    print("\nTraining XGBoost model...")
    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=8,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        n_jobs=-1,
        eval_metric='logloss',
        use_label_encoder=False
    )

    model.fit(
        X_train_scaled, y_train,
        eval_set=[(X_test_scaled, y_test)],
        verbose=True
    )

    # Evaluate
    print("\n" + "=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    y_pred = model.predict(X_test_scaled)
    y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]

    print(f"\nAccuracy:  {accuracy_score(y_test, y_pred):.4f}")
    print(f"Precision: {precision_score(y_test, y_pred):.4f}")
    print(f"Recall:    {recall_score(y_test, y_pred):.4f}")
    print(f"F1 Score:  {f1_score(y_test, y_pred):.4f}")
    print(f"ROC AUC:   {roc_auc_score(y_test, y_pred_proba):.4f}")

    print("\nConfusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    print(f"  TN: {cm[0,0]:,}  FP: {cm[0,1]:,}")
    print(f"  FN: {cm[1,0]:,}  TP: {cm[1,1]:,}")

    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Save', 'Goal']))

    # Feature importance
    print("\nTop 15 Feature Importances:")
    importance = pd.DataFrame({
        'feature': feature_names,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    for i, row in importance.head(15).iterrows():
        print(f"  {row['feature']}: {row['importance']:.4f}")

    # Calibration check
    print("\nPSxG Calibration Check (by predicted probability bucket):")
    df_cal = pd.DataFrame({'y_true': y_test, 'y_pred_proba': y_pred_proba})
    df_cal['bucket'] = pd.cut(df_cal['y_pred_proba'], bins=10)
    cal_stats = df_cal.groupby('bucket').agg({
        'y_true': ['count', 'mean'],
        'y_pred_proba': 'mean'
    }).round(3)
    print(cal_stats.to_string())

    return model, scaler, feature_names


def save_model(model, scaler, feature_names):
    """Save model artifacts"""
    print("\n" + "=" * 60)
    print("SAVING MODEL ARTIFACTS")
    print("=" * 60)

    # Save model
    with open('psxg_model.pkl', 'wb') as f:
        pickle.dump(model, f)
    print("Saved: psxg_model.pkl")

    # Save scaler
    with open('psxg_scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)
    print("Saved: psxg_scaler.pkl")

    # Save feature names
    with open('psxg_features.pkl', 'wb') as f:
        pickle.dump(feature_names, f)
    print("Saved: psxg_features.pkl")

    # Print file sizes
    for fname in ['psxg_model.pkl', 'psxg_scaler.pkl', 'psxg_features.pkl']:
        size = os.path.getsize(fname) / 1024
        print(f"  {fname}: {size:.1f} KB")


def main():
    print("=" * 60)
    print("PSxG MODEL TRAINING")
    print("=" * 60)

    # Load data
    data_path = 'psxg_synthetic_data_1m.csv'
    if not os.path.exists(data_path):
        print(f"ERROR: Data file not found: {data_path}")
        print("Please run generate_psxg_synthetic_data.py first")
        return

    X, y, feature_names = load_and_prepare_data(data_path)

    # Train model
    model, scaler, features = train_model(X, y, feature_names)

    # Save artifacts
    save_model(model, scaler, features)

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE!")
    print("=" * 60)


if __name__ == "__main__":
    main()
