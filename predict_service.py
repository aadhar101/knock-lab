import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from calculate_xg_enhanced import calculate_xg_enhanced
from calculate_psxg import calculate_psxg


def _parse_defenders(defenders):
    if not defenders:
        return []
    if isinstance(defenders, str):
        parsed = []
        for entry in defenders.split(";"):
            entry = entry.strip()
            if not entry:
                continue
            try:
                x_str, y_str = entry.split(",")
                parsed.append((float(x_str.strip()), float(y_str.strip())))
            except ValueError:
                continue
        return parsed

    return [tuple(item) for item in defenders]


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "No payload provided"}))
        return

    payload = json.loads(sys.argv[1])

    shot_x = float(payload.get("shot_x", 90))
    shot_y = float(payload.get("shot_y", 34))
    gk_x = float(payload.get("gk_x", 95))
    gk_y = float(payload.get("gk_y", 34))
    defenders = _parse_defenders(payload.get("defenders", []))
    shot_params = payload.get("shot_params", {"bodyPart": "Right Foot", "shotType": "Shot", "situation": "Open Play"})
    target_goal = payload.get("target_goal", "right")

    shot_end_x = float(payload.get("shot_end_x", 3.66))
    shot_end_y = float(payload.get("shot_end_y", 1.22))
    shot_speed = float(payload.get("shot_speed", 82))
    gk_goal_x = float(payload.get("gk_goal_x", 3.66))
    gk_goal_y = float(payload.get("gk_goal_y", 0.25))

    xg_result = calculate_xg_enhanced(
        shot_x=shot_x,
        shot_y=shot_y,
        gk_x=gk_x,
        gk_y=gk_y,
        defenders=defenders,
        shot_params=shot_params,
        target_goal=target_goal,
    )

    psxg_result = calculate_psxg(
        shot_end_x=shot_end_x,
        shot_end_y=shot_end_y,
        shot_speed=shot_speed,
        gk_x=gk_goal_x,
        gk_y=gk_goal_y,
        shot_distance=float(payload.get("shot_distance", xg_result.get("distance", 15.0))),
    )

    combined = round(xg_result["xg"] * psxg_result["psxg"], 4)

    result = {
        "xg": round(float(xg_result["xg"]), 4),
        "psxg": round(float(psxg_result["psxg"]), 4),
        "combined": combined,
        "xg_details": {
            "distance": round(float(xg_result.get("distance", 0)), 2),
            "angle": round(float(xg_result.get("angle", 0)), 2),
            "gk_distance": round(float(xg_result.get("gk_distance", 0)), 2),
            "shot_params_impact": round(float(xg_result.get("shot_params_impact", 1.0)), 3),
            "model_used": xg_result.get("model_used", "unknown"),
        },
        "psxg_details": {
            "zone": psxg_result.get("zone", "unknown"),
            "gk_dive_distance": round(float(psxg_result.get("gk_dive_distance", 0)), 2),
            "save_difficulty": psxg_result.get("save_difficulty", "Unknown"),
            "time_margin": round(float(psxg_result.get("time_margin", 0)), 3),
            "model_used": psxg_result.get("model_used", "unknown"),
        },
        "success": True,
        "message": "Prediction generated via local Python bridge",
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
