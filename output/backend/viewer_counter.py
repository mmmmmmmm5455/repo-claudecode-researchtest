"""Viewer count calculation per PRD Section 4.2.

The viewer count is computed backend-side and rendered by the frontend
7-segment display counter. It simulates a streaming platform viewer count
that responds to the emotional intensity of the game state.
"""


def calculate_viewer_count(
    emotion: float,
    infection: float,
    fragments: int,
    glitch_events: int = 0,
) -> int:
    """Calculate the simulated viewer count.

    Formula (from PRD 4.2):
      base = 1 (always at least 1 viewer)
      if emotion < 20: base += floor((20 - emotion) / 5)
      if infection > 60: base += floor((infection - 60) / 10)
      base += fragments
      base += glitch_events
      return min(base, 99)

    Args:
        emotion: 0-100 emotion value (lower = more negative)
        infection: 0-100 infection level
        fragments: 0-10 memory fragment count
        glitch_events: count of 'are you real?' popup events (default 0)

    Returns:
        Viewer count integer, clamped to [1, 99]
    """
    base = 1

    if emotion < 20:
        base += int((20 - emotion) // 5)

    if infection > 60:
        base += int((infection - 60) // 10)

    base += fragments
    base += glitch_events

    return min(base, 99)
