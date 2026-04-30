#!/usr/bin/env python3
"""lint_colors.py — CSS color palette compliance checker for Cybercore Y2K.

Validates all hex colors in CSS files against the 12-color PRD palette.
Also detects warm colors (R>200, G<50, B<50) which are forbidden except
for --color-taillight-red (#8B0000).

Usage:
    python lint_colors.py frontend/css/
    python lint_colors.py frontend/css/ --verbose
    python lint_colors.py main.css panels.css

Exit codes: 0 = pass, 1 = violations found, 2 = usage error
"""

import re
import sys
from pathlib import Path

ALLOWED_COLORS = {
    "#0A0D14", "#003344", "#1A2530", "#2A3540",
    "#33FF33", "#1A8C1A", "#8B4513", "#88CCFF",
    "#1A1025", "#8B0000", "#C0C0C0", "#708090",
}

ALLOWED_KEYWORDS = {"transparent", "inherit", "currentColor"}

FORBIDDEN_WARM = "#8B0000"  # taillight-red is the ONLY allowed warm color


def check_css_file(filepath: str) -> list[str]:
    violations = []
    path = Path(filepath)
    if not path.exists():
        return [f"{filepath}: FILE NOT FOUND"]

    content = path.read_text(encoding="utf-8", errors="replace")

    hex_colors = set(re.findall(r'#[0-9A-Fa-f]{6}', content))
    for c in hex_colors:
        if c.upper() not in ALLOWED_COLORS:
            violations.append(f"{filepath}: illegal color {c} (not in 12-color palette)")

    warm_matches = re.findall(r'#[0-9A-Fa-f]{6}', content)
    for c in warm_matches:
        if c.upper() == FORBIDDEN_WARM:
            continue
        r = int(c[1:3], 16)
        g = int(c[3:5], 16)
        b = int(c[5:7], 16)
        if r > 200 and g < 50 and b < 50:
            violations.append(f"{filepath}: warm color {c} rgb({r},{g},{b}) — only {FORBIDDEN_WARM} is allowed")

    return violations


def main():
    if len(sys.argv) < 2:
        print("Usage: python lint_colors.py <css_file_or_dir> [...]", file=sys.stderr)
        sys.exit(2)

    paths = sys.argv[1:]
    verbose = "--verbose" in paths
    if verbose:
        paths.remove("--verbose")

    css_files = []
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            css_files.extend(sorted(pp.rglob("*.css")))
        elif pp.is_file():
            css_files.append(pp)
        else:
            print(f"WARNING: {p} not found, skipping", file=sys.stderr)

    if not css_files:
        print("No CSS files found to check", file=sys.stderr)
        sys.exit(2)

    total_violations = []
    for f in css_files:
        violations = check_css_file(str(f))
        total_violations.extend(violations)
        if verbose and not violations:
            print(f"PASS {f}")

    if total_violations:
        for v in total_violations:
            print(f"VIOLATION: {v}")
        print(f"\n{len(total_violations)} violation(s) found in {len(css_files)} file(s)")
        sys.exit(1)
    else:
        print(f"PASS: {len(css_files)} file(s) comply with 12-color palette")
        sys.exit(0)


if __name__ == "__main__":
    main()
