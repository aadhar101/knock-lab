"""
FastAPI server for xG and PSxG calculation
The Geometry of Pressure (xG) & The Physics of Fate (PSxG)
"""
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Tuple, Dict, Any, Optional
import os
import webbrowser
import threading

app = FastAPI(title="The Geometry of Pressure & The Physics of Fate API", version="2.0.0")

# Enable CORS first
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (CSS, JS, images) - serve from current directory
app.mount("/static", StaticFiles(directory=".", html=True), name="static")

# Model is loaded by calculate_xg_enhanced module
# No global model state needed here

class ShotRequest(BaseModel):
    shot_x: float
    shot_y: float
    gk_x: float
    gk_y: float
    defenders: List[Tuple[float, float]]
    shot_params: Dict[str, Any]
    target_goal: str = 'right'

class XGResponse(BaseModel):
    xg: float
    distance: float
    angle: float
    defender_impact: Dict[str, Any]  # Changed from int to Any to support both int and float
    gk_distance: float
    shot_params_impact: float
    success: bool
    message: str = ""


# PSxG (Post-Shot Expected Goals) Models
class PSxGRequest(BaseModel):
    shot_end_x: float  # Horizontal position in goal (0-7.32m, 0=left post)
    shot_end_y: float  # Vertical position in goal (0-2.44m, 0=ground)
    shot_speed: float  # Shot speed in km/h
    gk_x: float  # GK horizontal position in goal frame
    gk_y: float  # GK vertical position (0=ground)
    shot_distance: float = 15.0  # Distance from which shot was taken


class PSxGResponse(BaseModel):
    psxg: float
    zone: str
    gk_dive_distance: float
    ball_travel_time: float
    gk_reach_time: float
    time_margin: float
    save_difficulty: str
    model_used: str
    shot_speed: float
    dist_from_center: float
    success: bool
    message: str = ""


# Combined xG + PSxG Request
class CombinedRequest(BaseModel):
    # xG inputs (pitch view)
    shot_x: float
    shot_y: float
    gk_x: float
    gk_y: float
    defenders: List[Tuple[float, float]]
    shot_params: Dict[str, Any]
    target_goal: str = 'right'
    # PSxG inputs (goal view)
    shot_end_x: float
    shot_end_y: float
    shot_speed: float
    gk_goal_x: float  # GK position in goal frame
    gk_goal_y: float


class CombinedResponse(BaseModel):
    xg: float
    psxg: float
    combined: float  # xG * PSxG or other combination
    xg_details: Dict[str, Any]
    psxg_details: Dict[str, Any]
    success: bool
    message: str = ""


def check_model_files():
    """Check which model files are available"""
    models_priority = [
        ('ultimate_xg_model.pkl', 'ultimate_xg_scaler.pkl', 'ultimate_xg_features.pkl', 'ultimate'),
        ('gk_aware_model.pkl', 'gk_aware_scaler.pkl', 'gk_aware_features.pkl', 'gk_aware'),
        ('defender_aware_model.pkl', 'defender_aware_scaler.pkl', 'defender_aware_features.pkl', 'defender_aware'),
    ]

    for model_file, scaler_file, features_file, name in models_priority:
        if os.path.exists(model_file) and os.path.exists(scaler_file) and os.path.exists(features_file):
            print(f"[OK] Found {name} model files")
            return True, name

    print("[⚠️] No model files found, will attempt to train ultimate model...")
    import subprocess
    import sys
    result = subprocess.run([sys.executable, 'train_ultimate_model.py'], capture_output=True, text=True)
    print(result.stdout)
    if result.returncode == 0:
        return check_model_files()  # Recursively check for newly trained model
    else:
        print(f"❌ Training failed: {result.stderr}")
        return False, "training_failed"

# All model training logic removed - use train_ultimate_model.py for training

def check_psxg_model():
    """Check if PSxG model files are available"""
    required_files = ['psxg_model.pkl', 'psxg_scaler.pkl', 'psxg_features.pkl']
    all_exist = all(os.path.exists(f) for f in required_files)
    if all_exist:
        print("[OK] Found PSxG model files")
    else:
        print("[⚠️] PSxG model files not found - run train_psxg_model.py")
    return all_exist


@app.on_event("startup")
async def startup_event():
    """Check model files on startup and open browser"""
    # Check xG model
    xg_success, xg_status = check_model_files()
    # Check PSxG model
    psxg_success = check_psxg_model()

    if xg_success and psxg_success:
        print(f"[OK] The Geometry of Pressure & The Physics of Fate - Ready!")
        print(f"     xG (Geometry): {xg_status}")
        print(f"     PSxG (Physics): xgboost")

        # Open browser after model check
        def open_browser():
            import time
            time.sleep(1.5)  # Wait for server to fully start
            webbrowser.open('http://localhost:8000')

        # Run in separate thread to not block startup
        threading.Thread(target=open_browser, daemon=True).start()
    elif xg_success:
        print(f"[WARN] xG model ready ({xg_status}), but PSxG model not available")
        print("[HINT] Run train_psxg_model.py to train PSxG model")
    else:
        print(f"[WARN] Server started but models not fully available")
        print("[HINT] Run train_ultimate_model.py for xG model")
        print("[HINT] Run train_psxg_model.py for PSxG model")

@app.get("/")
async def serve_index():
    """Serve the main HTML file"""
    return FileResponse('main.html')

@app.get("/style.css")
async def serve_css():
    """Serve the CSS file"""
    return FileResponse('style.css', media_type='text/css')

@app.get("/script.js")
async def serve_js():
    """Serve the JavaScript file"""
    return FileResponse('script.js', media_type='application/javascript')

@app.get("/favicon.ico")
async def serve_favicon():
    """Serve favicon (return 204 if not found)"""
    if os.path.exists('favicon.ico'):
        return FileResponse('favicon.ico')
    else:
        return Response(status_code=204)  # No content

@app.get("/root")
async def root():
    """Health check endpoint"""
    success, model_type = check_model_files()
    return {
        "message": "xG Calculator API is running",
        "model_available": success,
        "model_type": model_type if success else "none",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    success, model_type = check_model_files()
    return {
        "status": "healthy",
        "model_available": success,
        "model_type": model_type if success else "none"
    }

@app.post("/calculate_xg", response_model=XGResponse)
async def calculate_xg_endpoint(request: ShotRequest):
    """Calculate xG for a given shot scenario"""
    try:
        # Import calculate_xg_enhanced module
        try:
            from calculate_xg_enhanced import calculate_xg_enhanced
        except ImportError as e:
            raise HTTPException(
                status_code=500,
                detail=f"calculate_xg_enhanced module not found: {str(e)}"
            )

        # Calculate xG
        result = calculate_xg_enhanced(
            shot_x=request.shot_x,
            shot_y=request.shot_y,
            gk_x=request.gk_x,
            gk_y=request.gk_y,
            defenders=request.defenders,
            shot_params=request.shot_params,
            target_goal=request.target_goal
        )

        return XGResponse(
            xg=result['xg'],
            distance=result['distance'],
            angle=result['angle'],
            defender_impact=result['defender_impact'],
            gk_distance=result['gk_distance'],
            shot_params_impact=result['shot_params_impact'],
            success=True,
            message=f"xG calculated successfully using {result.get('model_used', 'unknown')} model"
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Error calculating xG: {error_details}")
        raise HTTPException(status_code=500, detail=f"Error calculating xG: {str(e)}")


@app.post("/calculate_psxg", response_model=PSxGResponse)
async def calculate_psxg_endpoint(request: PSxGRequest):
    """Calculate PSxG (Post-Shot Expected Goals) for a given shot placement"""
    try:
        from calculate_psxg import calculate_psxg

        result = calculate_psxg(
            shot_end_x=request.shot_end_x,
            shot_end_y=request.shot_end_y,
            shot_speed=request.shot_speed,
            gk_x=request.gk_x,
            gk_y=request.gk_y,
            shot_distance=request.shot_distance
        )

        return PSxGResponse(
            psxg=result['psxg'],
            zone=result['zone'],
            gk_dive_distance=result['gk_dive_distance'],
            ball_travel_time=result['ball_travel_time'],
            gk_reach_time=result['gk_reach_time'],
            time_margin=result['time_margin'],
            save_difficulty=result['save_difficulty'],
            model_used=result['model_used'],
            shot_speed=result['shot_speed'],
            dist_from_center=result['dist_from_center'],
            success=True,
            message=f"PSxG calculated successfully using {result['model_used']} model"
        )

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Error calculating PSxG: {error_details}")
        raise HTTPException(status_code=500, detail=f"Error calculating PSxG: {str(e)}")


@app.post("/calculate_combined", response_model=CombinedResponse)
async def calculate_combined_endpoint(request: CombinedRequest):
    """Calculate both xG and PSxG and return combined result"""
    try:
        from calculate_xg_enhanced import calculate_xg_enhanced
        from calculate_psxg import calculate_psxg

        # Calculate xG
        xg_result = calculate_xg_enhanced(
            shot_x=request.shot_x,
            shot_y=request.shot_y,
            gk_x=request.gk_x,
            gk_y=request.gk_y,
            defenders=request.defenders,
            shot_params=request.shot_params,
            target_goal=request.target_goal
        )

        # Calculate PSxG
        psxg_result = calculate_psxg(
            shot_end_x=request.shot_end_x,
            shot_end_y=request.shot_end_y,
            shot_speed=request.shot_speed,
            gk_x=request.gk_goal_x,
            gk_y=request.gk_goal_y,
            shot_distance=xg_result['distance']
        )

        # Combined probability (simplified: xG represents chance quality, PSxG represents execution)
        # Various combination methods possible - using simple product here
        combined = xg_result['xg'] * psxg_result['psxg']

        return CombinedResponse(
            xg=xg_result['xg'],
            psxg=psxg_result['psxg'],
            combined=round(combined, 4),
            xg_details={
                'distance': xg_result['distance'],
                'angle': xg_result['angle'],
                'defender_impact': xg_result['defender_impact'],
                'gk_distance': xg_result['gk_distance'],
                'model_used': xg_result.get('model_used', 'unknown')
            },
            psxg_details={
                'zone': psxg_result['zone'],
                'gk_dive_distance': psxg_result['gk_dive_distance'],
                'save_difficulty': psxg_result['save_difficulty'],
                'time_margin': psxg_result['time_margin'],
                'model_used': psxg_result['model_used']
            },
            success=True,
            message="Combined xG + PSxG calculated successfully"
        )

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"❌ Error calculating combined: {error_details}")
        raise HTTPException(status_code=500, detail=f"Error calculating combined: {str(e)}")


@app.get("/psxg_zones")
async def get_psxg_zones():
    """Get base PSxG values for each goal zone (for UI heatmap)"""
    from calculate_psxg import get_zone_psxg_map
    return {
        "zones": get_zone_psxg_map(),
        "goal_width": 7.32,
        "goal_height": 2.44
    }


class ZonePSxGRequest(BaseModel):
    gk_x: float = 3.66  # GK horizontal position (default: center)
    gk_y: float = 0.0   # GK vertical position (default: ground)
    shot_speed: float = 80.0  # Shot speed in km/h
    shot_distance: float = 15.0  # Distance from goal


@app.post("/calculate_zone_psxg")
async def calculate_zone_psxg(request: ZonePSxGRequest):
    """
    Calculate PSxG for all 12 zones (4x3 grid) based on GK position.
    Returns PSxG values for each zone center point.
    """
    try:
        from calculate_psxg import calculate_psxg

        # Goal dimensions
        GOAL_WIDTH = 7.32
        GOAL_HEIGHT = 2.44

        # 4 columns x 3 rows = 12 zones
        cols = 4
        rows = 3
        col_width = GOAL_WIDTH / cols  # 1.83m
        row_height = GOAL_HEIGHT / rows  # 0.813m

        zones = []

        for row in range(rows):
            for col in range(cols):
                # Calculate zone center
                zone_center_x = (col + 0.5) * col_width
                zone_center_y = (row + 0.5) * row_height

                # Calculate PSxG for this zone center
                result = calculate_psxg(
                    shot_end_x=zone_center_x,
                    shot_end_y=zone_center_y,
                    shot_speed=request.shot_speed,
                    gk_x=request.gk_x,
                    gk_y=request.gk_y,
                    shot_distance=request.shot_distance
                )

                zones.append({
                    'row': row,  # 0=bottom, 1=middle, 2=top
                    'col': col,  # 0=left, 1=center-left, 2=center-right, 3=right
                    'center_x': round(zone_center_x, 3),
                    'center_y': round(zone_center_y, 3),
                    'psxg': result['psxg'],
                    'zone_name': result['zone'],
                    'save_difficulty': result['save_difficulty']
                })

        return {
            'zones': zones,
            'gk_position': {'x': request.gk_x, 'y': request.gk_y},
            'shot_speed': request.shot_speed,
            'shot_distance': request.shot_distance,
            'grid': {'cols': cols, 'rows': rows},
            'goal': {'width': GOAL_WIDTH, 'height': GOAL_HEIGHT},
            'success': True
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error calculating zone PSxG: {error_details}")
        raise HTTPException(status_code=500, detail=f"Error calculating zone PSxG: {str(e)}")


@app.get("/model_info")
async def model_info():
    """Get information about which models are available"""
    import os
    import datetime

    models = {
        'gk_aware': {
            'file': 'gk_aware_model.pkl',
            'exists': os.path.exists('gk_aware_model.pkl'),
            'priority': 1,
            'description': 'GK-aware model with augmented training (BEST)'
        },
        'defender_aware': {
            'file': 'defender_aware_model.pkl',
            'exists': os.path.exists('defender_aware_model.pkl'),
            'priority': 2,
            'description': 'Defender-aware model with individual positions'
        },
        'hybrid': {
            'file': 'hybrid_xgboost_model.pkl',
            'exists': os.path.exists('hybrid_xgboost_model.pkl'),
            'priority': 3,
            'description': 'Hybrid XGBoost model'
        }
    }

    # Add file info for existing models
    for key, info in models.items():
        if info['exists']:
            fpath = info['file']
            stat = os.stat(fpath)
            info['size_mb'] = round(stat.st_size / (1024*1024), 2)
            info['modified'] = datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')

    # Determine which model is currently in use
    active_model = "unknown"
    if os.path.exists('gk_aware_model.pkl'):
        active_model = "gk_aware"
    elif os.path.exists('defender_aware_model.pkl'):
        active_model = "defender_aware"
    elif os.path.exists('hybrid_xgboost_model.pkl'):
        active_model = "hybrid"

    return {
        "active_model": active_model,
        "available_models": models
    }

@app.post("/reload_model")
async def reload_model():
    """Reload the model from pickle files (for calculate_xg_enhanced hot-reload)"""
    # Force Python to reload the module
    import importlib
    import sys

    # Remove cached module
    if 'calculate_xg_enhanced' in sys.modules:
        del sys.modules['calculate_xg_enhanced']

    # Check what model will be loaded
    import os
    model_to_load = "unknown"
    if os.path.exists('gk_aware_model.pkl'):
        model_to_load = "gk_aware"
    elif os.path.exists('defender_aware_model.pkl'):
        model_to_load = "defender_aware"
    else:
        model_to_load = "fallback"

    return {
        "message": f"Module cache cleared, will use {model_to_load} model on next request",
        "success": True,
        "model_to_load": model_to_load
    }

@app.post("/retrain_model")
async def retrain_model_endpoint():
    """Retrain the model from scratch - delegates to train_ultimate_model.py"""
    try:
        import subprocess
        import sys
        print("[INFO] Retraining model requested via API...")
        result = subprocess.run([sys.executable, 'train_ultimate_model.py'], capture_output=True, text=True)

        if result.returncode == 0:
            print(result.stdout)
            return {"message": "Model retrained successfully", "success": True, "output": result.stdout}
        else:
            print(f"❌ Training failed: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"Training failed: {result.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during retraining: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
