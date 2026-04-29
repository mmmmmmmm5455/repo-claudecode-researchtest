"""Scene trigger logic per PRD Section 3.3.

Maps (emotion_value, infection_level) -> scene identifier string.
Used by game_engine.py after each action to determine background scene.
"""

from typing import Tuple


def select_scene(emotion: float, infection: float) -> str:
    """Select 3D background scene based on game state.

    Priority logic (first match wins):
      1. infection > 70%           -> blizzard_street
      2. infection > 50% AND emotion < 30 -> snow_bridge
      3. emotion < 40              -> blizzard_street
      4. emotion < 70              -> rain_underpass
      5. default                   -> fog_highway

    Args:
        emotion: 0-100 emotion value
        infection: 0-100 infection level

    Returns:
        Scene identifier: 'rain_underpass' | 'snow_bridge' | 'fog_highway' | 'blizzard_street'
    """
    if infection > 70:
        return "blizzard_street"
    if infection > 50 and emotion < 30:
        return "snow_bridge"
    if emotion < 40:
        return "blizzard_street"
    if emotion < 70:
        return "rain_underpass"
    return "fog_highway"


def get_scene_transition(old_scene: str, new_scene: str) -> dict:
    """Return transition parameters for crossfade between scenes.

    Args:
        old_scene: previous scene identifier
        new_scene: target scene identifier

    Returns:
        dict with keys: transition_type, duration_ms, crt_noise
    """
    if old_scene == new_scene:
        return {"transition_type": "none", "duration_ms": 0, "crt_noise": False}
    return {"transition_type": "crossfade", "duration_ms": 3000, "crt_noise": True}
