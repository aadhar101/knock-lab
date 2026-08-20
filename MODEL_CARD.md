# IOA Model Card: StrikeLab — Post-Shot xG & Ultimate Pre-Shot xG

---

## 1. Model Summary

| Field | PSxG (Post-Shot Expected Goals) | Ultimate xG (Pre-Shot Expected Goals) |
|-------|----------------------------------|----------------------------------------|
| **Model Name** | `psxg_model.pkl` | `ultimate_xg_model.pkl` |
| **Version** | 1.0 (trained 2025) | 1.0 (trained 2025) |
| **Model Type** | Gradient-Boosted Decision Trees (XGBoost) | Gradient-Boosted Decision Trees (XGBoost) |
| **Task** | Binary classification: probability a shot on target scores | Binary classification: probability a shot becomes a goal |
| **License** | Proprietary / Research use | Proprietary / Research use |
| **Training Data** | 1,000,000 synthetic samples (physics-informed) | ~500,000 professional shots (syntheticised Premier League) |
| **Primary Metric** | ROC-AUC, Brier Score, Calibration | ROC-AUC, Brier Score, Calibration |
| **Intended Use** | Prescriptive shot analytics: evaluate strike quality, recommend optimal placement, support goalkeeper positioning | Prescriptive shot analytics: evaluate chance quality, support pre-shot decision-making |
| **Author / Maintainer** | Footylytics / StrikeLab Thesis Project | Footylytics / StrikeLab Thesis Project |
| **Contact** | Research thesis: "Design and Development of a Prescriptive Shot-Analytics System for Football" | Research thesis: "Design and Development of a Prescriptive Shot-Analytics System for Football" |

---

## 2. Model Details

### 2.1 PSxG Model (Post-Shot Expected Goals)

**Architecture:** XGBoost Classifier  
**Hyperparameters:**
- `n_estimators`: 200
- `max_depth`: 8
- `learning_rate`: 0.1
- `subsample`: 0.8
- `colsample_bytree`: 0.8
- `min_child_weight`: 3
- `gamma`: 0.1
- `reg_alpha`: 0.1
- `reg_lambda`: 1.0
- `eval_metric`: logloss
- `random_state`: 42

**Features (27 total):**
- Base (13): `shot_end_x`, `shot_end_y`, `shot_speed`, `shot_distance`, `gk_x`, `gk_y`, `gk_dive_distance`, `ball_travel_time`, `dist_from_center`, `dist_from_left_post`, `dist_from_right_post`, `dist_from_crossbar`, `dist_from_ground`
- Derived (14): `shot_end_x_normalized`, `shot_end_y_normalized`, `gk_offset_x`, `gk_offset_y`, `corner_distance_tl`, `corner_distance_tr`, `corner_distance_bl`, `corner_distance_br`, `is_top_half`, `is_left_half`, `is_corner_shot`, `speed_category`, `gk_coverage_ratio`, `time_margin`

**Target:** `is_goal` (binary: 1 = goal, 0 = save)

**Preprocessing:** StandardScaler fitted on training data.

**Goal Dimensions:** 7.32m × 2.44m (standard FIFA)

**Goalkeeper Biomechanics (used in synthetic generation):**
- Horizontal dive speed: 4.0 m/s
- Vertical dive speed: 2.5 m/s
- Reaction time: 0.15s (base) + N(0, 0.05) variance
- Arm reach: 0.75m
- Standing reach height: 2.30m

---

### 2.2 Ultimate xG Model (Pre-Shot Expected Goals)

**Architecture:** XGBoost Classifier  
**Hyperparameters:**
- `n_estimators`: 800
- `max_depth`: 12
- `learning_rate`: 0.02
- `subsample`: 0.8
- `colsample_bytree`: 0.6
- `gamma`: 2.0
- `reg_alpha`: 0.25
- `reg_lambda`: 2.5
- `min_child_weight`: 35
- `scale_pos_weight`: class-imbalance ratio (~9:1)
- `tree_method`: hist
- `random_state`: 42

**Features (99 total, grouped):**
- Position (5): `x_coord`, `y_coord`, `distance_to_goal`, `angle_to_goal`, `center_distance`
- Goalkeeper (9): `gk_x`, `gk_y`, `gk_distance`, `gk_off_center`, `gk_advanced`, `gk_to_goal_dist`, `gk_angle_to_shot`, `gk_coverage_angle`, `gk_shot_line_distance`
- Shot Quality — NEW (10): `shot_power`, `shot_placement`, `normalized_shot_power`, `normalized_shot_placement`, `shot_quality_score`, `power_distance_interaction`, `placement_gk_interaction`, `power_category_weak`, `power_category_strong`, `placement_category_good`
- Pressure & First Touch — NEW (7): `is_first_touch`, `is_under_pressure`, `first_touch_difficulty`, `pressure_distance_interaction`, `pressure_angle_reduction`, `quality_under_pressure`, `first_touch_quality`
- Game State — NEW (9): `match_score_diff`, `is_losing`, `is_winning`, `is_drawing`, `desperation_factor`, `score_time_interaction`, `is_second_half`, `half_minute`, `is_first_half`
- Individual Defenders (32): 8 defenders × 4 metrics each (`def{i}_x`, `def{i}_y`, `def{i}_distance`, `def{i}_blocking`)
- Aggregate Defenders (8): `defenders_very_close`, `defenders_close`, `defenders_blocking`, `closest_defender_dist`, `avg_closest_3_defenders`, `corridor_defenders`, `defensive_compactness`, `second_line_defenders`
- Shot Characteristics (7): `is_header`, `distance_angle_interaction`, `is_close_shot`, `is_central`, `clear_path`, `shooting_lane_width`, `effective_goal_size`
- Mathematical (4): `log_distance`, `sin_angle`, `cos_angle`, `shot_difficulty`
- Time (4): `minute`, `is_late_game`, `is_injury_time`, `fatigue_factor`
- Combination (4): `gk_challenge_difficulty`, `desperation_shot`, `gk_defender_interaction`, `gk_distance_shot_difficulty`

**Target:** `goal_scored` (binary)

**Preprocessing:** StandardScaler fitted on training data. Missing values filled with 0.

**Data Augmentation:** Added synthetic tap-in scenarios with GK out of position (10k additional samples, 95–100% goal rate).

---

## 3. Performance Metrics

### 3.1 PSxG Model (reported in training script output)

| Metric | Value |
|--------|-------|
| Accuracy | ~0.91–0.93* |
| Precision (Goal) | ~0.75–0.80* |
| Recall (Goal) | ~0.70–0.78* |
| F1 Score (Goal) | ~0.72–0.79* |
| **ROC-AUC** | **~0.92–0.95*** |
| Brier Score | ~0.08–0.10* |

*Exact values depend on training run; see training script output for current run. Model is evaluated on 20% held-out test set (200k samples), stratified.

**Calibration:** Evaluated via 10-bin reliability diagram; predicted probabilities align with observed goal rates (see `train_psxg_model.py` calibration check).

---

### 3.2 Ultimate xG Model (reported in training script output)

| Metric | Value |
|--------|-------|
| Accuracy | ~0.94–0.95* |
| **ROC-AUC** | **~0.95–0.97*** |
| Brier Score | ~0.05–0.07* |

*Exact values depend on training run; see training script output. Model evaluated on 20% held-out test set (100k shots), stratified. Class imbalance handled via `scale_pos_weight`.

**Feature Importance (top categories):**
- Shot Quality (NEW): ~25–30% aggregate importance
- GK Features: ~20–25%
- Defender Features (individual + aggregate): ~20–25%
- Pressure/First Touch (NEW): ~8–12%
- Game State (NEW): ~5–8%
- Position/Spatial: ~8–12%

---

## 4. Training Data

### 4.1 PSxG Training Data

- **Source:** Synthetic, physics-informed generator (`generate_psxg_synthetic_data.py`)
- **Size:** 1,000,000 samples
- **Generation Process:**
  1. Shot end position sampled from realistic distributions (corner-aimed 25%, side-aimed 35%, central 30%, wild 10%)
  2. Shot speed sampled from mixture (weak 15%, normal 45%, powerful 30%, thunderbolt 10%)
  3. Shot distance: Exponential(12) + 5m, clipped [5, 40]m
  4. GK position: Normal around center (3.66m), clipped [1.0, 6.32]m; vertical ∈ {0, 0.3, 0.5}
  5. GK anticipation bias: slight shift toward shot side (0–0.3m)
  6. Physics: ball travel time, GK reach time, reaction time → save probability
  7. Corner/awkward-position penalties applied
  8. Binary outcome sampled from computed PSxG

- **Goal Rate:** ~9–11% (matches real football ~1 in 9–10)
- **Class Imbalance:** ~9:1 (saves:goals)
- **Limitations:** **No real match data used.** Synthetic generator encodes assumptions about biomechanics, shot distributions, and GK behaviour that may not match reality. No defender positions, no game state, no fatigue, no psychological factors.

---

### 4.2 Ultimate xG Training Data

- **Source:** Syntheticised Premier League-style dataset (`premier_league_xg_dataset_large_new.csv`, 500k shots)
- **Size:** ~500,000 shots (plus ~10k augmented tap-ins)
- **Features:** Rich spatial, contextual, and shot-quality features (see Section 2.2)
- **Goal Rate:** ~9.5% (after augmentation)
- **Class Imbalance:** ~9.5:1
- **Limitations:** **Syntheticised / not real StatsBomb/Opta data.** The dataset is generated to resemble professional match distributions but does not contain actual player-tracking or event data. Real-data validation is identified as the principal future-work item.

---

## 5. Evaluation

### 5.1 Discrimination
- **ROC-AUC** reported for both models on held-out test sets (20%, stratified).
- PSxG: AUC ~0.92–0.95
- Ultimate xG: AUC ~0.95–0.97

### 5.2 Calibration
- **Reliability diagrams** (10 bins) generated during PSxG training.
- **Brier Score** computed for both models.
- Calibration is a first-class evaluation criterion; the thesis explicitly requires both discrimination and calibration.

### 5.3 Prescriptive Layer Evaluation
- **Shot Coach:** Expected-value maximisation over goal frame with execution-error model (Gaussian spread increasing with placement difficulty).
- **Keeper Coach:** Minimax optimisation over GK lateral position; evaluates striker's best response at each candidate position via batched inference.
- **Qualitative validation:** Tested on canonical scenarios (penalty, 1v1, GK off-line) for tactical plausibility.

### 5.4 Known Evaluation Gaps
- **No real-data validation** for either model (especially PSxG).
- **No temporal splitting** (random split used; would leak future→past in real deployment).
- **No user/stakeholder study** for ethical risk assessment (H2).
- **No out-of-distribution testing** (e.g., unusual GK positions, extreme shot speeds).

---

## 6. Intended Use

### 6.1 Primary Use Cases
1. **Shot Coach (PSxG-driven):** Given GK position, recommend the aim point maximising expected scoring probability, accounting for execution error (harder placements → lower accuracy).
2. **Keeper Coach (Minimax):** Given striker's PSxG surface, compute GK position that minimises the striker's best available option.
3. **Danger Map Visualisation:** Interactive PSxG heatmap over goal frame for a given scenario.
4. **Pre-Shot Chance Evaluation (Ultimate xG):** Assess chance quality before the strike, incorporating defenders, GK, shot quality, pressure, and game state.
5. **Combined xG × PSxG:** End-to-end probability from chance creation to strike execution.

### 6.2 Out-of-Scope / Misuse
- **Not a real-time in-game tool.** Models run offline / in training; inference is fast but not validated for live match latency.
- **Not a substitute for coaching judgement.** Outputs are probabilistic benchmarks, not instructions.
- **Not validated for gambling / betting applications.**
- **Not for player recruitment or contract decisions** without real-data validation.
- **Not for youth/amateur football** (biomechanics differ from pro GK assumptions).

---

## 7. Limitations & Caveats

| Limitation | Severity | Mitigation |
|------------|----------|------------|
| **PSxG trained entirely on synthetic data** | Critical | Explicit disclosure in UI, docs, thesis; real-data validation prioritised as future work |
| **Ultimate xG trained on syntheticised (not real) event data** | High | Pipeline architected for real-data swap-in; temporal splitting planned |
| **No defender positions in PSxG** | High | PSxG conditions on ball reaching frame; defenders affect pre-shot xG only |
| **GK biomechanics are population averages** | Medium | Individual GK variation not modelled; could be personalised with tracking data |
| **Execution-error model is Gaussian & independent** | Medium | Real errors may be correlated (fatigue, pressure, surface) |
| **Minimax assumes rational, fully informed opponents** | Medium | Bounded rationality acknowledged; real players satisfice |
| **One-dimensional GK positioning (lateral only)** | Medium | Depth/height positioning not optimised |
| **No temporal validation** | High | Future work: train on seasons 1..t, test on t+1 |
| **No fairness / demographic analysis** | Low | No player identity in synthetic data; real-data version would need this |
| **Model cards / documentation only in English** | Low | — |

---

## 8. Ethical Considerations

### 8.1 Transparency by Design
- **Danger maps** render PSxG surface visually (not opaque score).
- **Feature importance** reported for both models.
- **Uncertainty** communicated: PSxG returns `save_difficulty` categories, time margins, zone labels.
- **Synthetic-data basis** disclosed in UI, API responses (`model_used` field), and all documentation.

### 8.2 Over-Reliance Risk
- Outputs framed as **decision-support benchmarks**, not prescriptions.
- UI avoids authoritative language ("optimal" → "recommended", "best" → "highest expected value").
- Thesis explicitly models bounded rationality: tool is for offline analysis/training, not in-match command.

### 8.3 Competitive Exploitation
- Methodology open and documented to democratise access.
- Intended use declared: analytical, educational, coaching support.
- No personal/player data in current models (synthetic only).

### 8.4 Future Real-Data Deployment
- Would reintroduce **GDPR / player consent** obligations.
- Would require **fairness audits** across leagues, positions, demographics.
- Would require **temporal validation** to avoid leakage.

---

## 9. Deployment & Serving

### 9.1 API Endpoints (`api_server.py`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/calculate_xg` | POST | Pre-shot xG (Ultimate model) |
| `/calculate_psxg` | POST | Post-shot xG (PSxG model) |
| `/calculate_combined` | POST | Both models combined |
| `/calculate_zone_psxg` | POST | 12-zone PSxG grid for danger map |
| `/psxg_zones` | GET | Base zone PSxG values |
| `/model_info` | GET | Available model files & active model |
| `/health` | GET | Health check |
| `/retrain_model` | POST | Trigger `train_ultimate_model.py` |
| `/reload_model` | POST | Hot-reload model module |

### 9.2 Model Loading
- Models loaded lazily on first request (pickle deserialisation).
- `calculate_psxg.py` falls back to physics-based calculation if model files missing.
- `api_server.py` auto-trains Ultimate model if no model files found on startup.

### 9.3 Runtime Requirements
- Python 3.10+
- Dependencies: `fastapi`, `uvicorn`, `xgboost`, `scikit-learn`, `numpy`, `pandas`, `pydantic`
- Model artifacts: `.pkl` files (model, scaler, feature list) must be present.

---

## 10. Reproducibility

### 10.1 Regenerate PSxG Training Data
```bash
python generate_psxg_synthetic_data.py
# Output: psxg_synthetic_data_1m.csv (~96 MB, git-ignored)
```

### 10.2 Train PSxG Model
```bash
python train_psxg_model.py
# Outputs: psxg_model.pkl, psxg_scaler.pkl, psxg_features.pkl
```

### 10.3 Train Ultimate xG Model
```bash
python train_ultimate_model.py
# Requires: premier_league_xg_dataset_large_new.csv (not in repo)
# Outputs: ultimate_xg_model.pkl, ultimate_xg_scaler.pkl, ultimate_xg_features.pkl
```

### 10.4 Run API Server
```bash
pip install -r requirements.txt
uvicorn api_server:app --reload
# Opens http://localhost:8000
```

### 10.5 Random Seeds
- Data generation: `np.random.seed(42)`
- Train/test splits: `random_state=42`
- Model training: `random_state=42`

---

## 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025 | Initial release: PSxG (1M synthetic), Ultimate xG (500k syntheticised), Shot Coach, Keeper Coach, FastAPI server, Next.js frontend |

---

## 12. References

- Chen, T. & Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System. *KDD*.
- Palacios-Huerta, I. (2003). Professionals Play Minimax. *Review of Economic Studies*.
- Friedman, J. (2001). Greedy Function Approximation: A Gradient Boosting Machine. *Annals of Statistics*.
- Thesis: "Design and Development of a Prescriptive Shot-Analytics System for Football Using Expected-Goals Concept, appropriate Machine Learning and Game-Theoretic Optimisation Techniques" (KnockLab, 2025).

---

## 13. Appendix: Model Artifacts Checklist

| Artifact | PSxG | Ultimate xG |
|----------|------|-------------|
| Model pickle | ✅ `psxg_model.pkl` | ✅ `ultimate_xg_model.pkl` |
| Scaler pickle | ✅ `psxg_scaler.pkl` | ✅ `ultimate_xg_scaler.pkl` |
| Feature list pickle | ✅ `psxg_features.pkl` | ✅ `ultimate_xg_features.pkl` |
| Training script | ✅ `train_psxg_model.py` | ✅ `train_ultimate_model.py` |
| Data generator | ✅ `generate_psxg_synthetic_data.py` | ❌ (external dataset) |
| Inference module | ✅ `calculate_psxg.py` | ✅ `calculate_xg_enhanced.py` |
| API endpoints | ✅ `/calculate_psxg`, `/calculate_zone_psxg` | ✅ `/calculate_xg`, `/calculate_combined` |

---

*This model card follows the IOA (Intended Use, Operation, Accountability) framework and the structure proposed by Mitchell et al. (2019) "Model Cards for Model Reporting". It is a living document; update on retraining, real-data validation, or deployment changes.*