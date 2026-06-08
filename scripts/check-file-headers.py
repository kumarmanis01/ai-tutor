#!/usr/bin/env python3
"""
scripts/check-file-headers.py

Pre-commit check: every staged app .ts/.tsx file must contain both a
FILE OBJECTIVE block and an EDIT LOG block in the top-of-file comment.

Runs automatically via husky pre-commit. To skip in an emergency:
  SKIP_HEADER_CHECK=1 git commit ...

Usage:
  python3 scripts/check-file-headers.py              # check staged files
  python3 scripts/check-file-headers.py a.ts b.tsx   # check specific files
"""
import os
import re
import subprocess
import sys

# ── Skip patterns ────────────────────────────────────────────────────────────
# Any file whose path matches one of these regex patterns is excluded from the
# check. Test files, config files, generated output, and utility scripts do not
# require the standard app-file header.
SKIP_PATTERNS = [
    r'(^|/)tests/',
    r'(^|/)__tests__/',
    r'\.test\.[tj]sx?$',
    r'\.spec\.[tj]sx?$',
    r'(^|/)scripts/',
    r'\.d\.ts$',
    r'(^|\.)config\.[tj]sx?$',
    r'tailwind\.config',
    r'jest\.config',
    r'next\.config',
    r'postcss\.config',
    r'(^|/)prisma/',
    r'(^|/)dist/',
    r'(^|/)node_modules/',
    r'(^|/)\.husky/',
    r'(^|/)\.next/',
    r'(^|/)types/',        # ambient .d.ts directories
]

HEADER_SCAN_BYTES = 6000   # only scan the first ~6 KB (header lives at top)
REQUIRED_MARKERS = ['FILE OBJECTIVE', 'EDIT LOG']


def should_skip(path: str) -> bool:
    for pattern in SKIP_PATTERNS:
        if re.search(pattern, path):
            return True
    return False


def get_staged_ts_files() -> list:
    result = subprocess.run(
        ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
        capture_output=True,
        text=True,
    )
    files = result.stdout.strip().split('\n')
    return [
        f for f in files
        if f and (f.endswith('.ts') or f.endswith('.tsx')) and not should_skip(f)
    ]


def check_file(path: str) -> list:
    """Return a list of missing-marker strings, or [] when the file is fine."""
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            head = fh.read(HEADER_SCAN_BYTES)
    except OSError:
        return []  # deleted or unreadable — not our problem here
    return [m for m in REQUIRED_MARKERS if m not in head]


def main() -> None:
    if os.environ.get('SKIP_HEADER_CHECK') == '1':
        print('SKIP_HEADER_CHECK=1 -- skipping file header check')
        sys.exit(0)

    # Accept explicit file list from CLI args, otherwise use git staged files.
    if len(sys.argv) > 1:
        candidates = [
            f for f in sys.argv[1:]
            if (f.endswith('.ts') or f.endswith('.tsx')) and not should_skip(f)
        ]
    else:
        candidates = get_staged_ts_files()

    if not candidates:
        sys.exit(0)

    failures: dict = {}
    for path in candidates:
        missing = check_file(path)
        if missing:
            failures[path] = missing

    if not failures:
        print(f'[header-check] OK -- {len(candidates)} file(s) checked, all headers present')
        sys.exit(0)

    RED = '\033[31m'
    YEL = '\033[33m'
    RST = '\033[0m'
    print(f'\n{RED}[header-check] FAILED -- missing required header blocks{RST}')
    print('Every modified app .ts/.tsx file must have FILE OBJECTIVE and EDIT LOG.\n')
    for path, missing in failures.items():
        for marker in missing:
            print(f'  {YEL}{path}{RST}  --  missing {marker}: block')
    print('\nRequired format (at the very top of the file):')
    print('  /**')
    print('   * FILE OBJECTIVE:')
    print('   * - <one-line description>')
    print('   *')
    print('   * EDIT LOG:')
    print('   * - YYYY-MM-DDTHH:MM:SSZ | <author> | <what changed and why>')
    print('   */')
    print('\nTo skip (emergencies only): SKIP_HEADER_CHECK=1 git commit ...\n')
    sys.exit(1)


if __name__ == '__main__':
    main()
