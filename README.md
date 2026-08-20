# Post-Strike xG (The Physics of Fate)

Standalone demo for the **Geometry of Pressure (xG)** and **Physics of Fate (PSxG)**
chapter: a FastAPI server (`api_server.py`) backing an interactive pitch + goal-frame
UI (`main.html` / `script.js` / `style.css`).

This repository now also includes a modern Next.js frontend in the `frontend` folder.

## Run
```bash
pip install fastapi uvicorn xgboost scikit-learn numpy pandas
uvicorn api_server:app --reload   # opens http://localhost:8000
```

## Run the full stack
```bash
# Terminal 1
python -m uvicorn api_server:app --host 0.0.0.0 --port 8000

# Terminal 2
cd frontend
npm run dev
```

Open http://localhost:3000 for the new UI.

## What's here
- **UI**: `main.html`, `script.js`, `style.css`, and the new Next.js app in `frontend`
- **Server**: `api_server.py` (+ `calculate_psxg.py`, `calculate_xg_enhanced.py`, modifier JSONs)
- **Models** (committed): `psxg_model.pkl` / `psxg_scaler.pkl` / `psxg_features.pkl`,
  `ultimate_xg_model.pkl` / `ultimate_xg_scaler.pkl` / `ultimate_xg_features.pkl`
- **Sample data**: `sample_psxg_dataset.csv`, `psxg_synthetic_data_sample.csv`,
  `sample_match_upload*.csv`, and scenario CSVs in `datasets/`
- **Reproduce the training data/models**: `generate_psxg_synthetic_data.py`,
  `train_psxg_model.py`, `train_ultimate_model.py`

## Data note
The models are trained on **synthetic** data (not StatsBomb). The full PSxG training
set (`psxg_synthetic_data_1m.csv`, ~96 MB) is **git-ignored**; regenerate it with
`python generate_psxg_synthetic_data.py`.

The **Explain Scenario** and **Model Details** controls from the original demo have
been removed from this build.
