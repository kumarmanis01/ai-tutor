#!/usr/bin/env python3
"""
scripts/fix-smart-quotes.py
Replaces Unicode smart quotes with ASCII equivalents in all .ts/.tsx files.
Also warns (never auto-fixes) about apostrophes inside single-quoted string
literals, e.g. 'don't' — these cause tsc parse errors and are ambiguous to
fix automatically.
Run before every commit or after any AI-assisted code generation.
Usage:
  python3 scripts/fix-smart-quotes.py           # fix all
  python3 scripts/fix-smart-quotes.py --check   # check only, exit 1 if found
"""
import os
import re
import sys

ROOTS = ['app', 'lib', 'worker', 'components', 'scripts']
REPLACEMENTS = [
    (b'\xe2\x80\x98', b"'"),   # ' left single
    (b'\xe2\x80\x99', b"'"),   # ' right single / apostrophe
    (b'\xe2\x80\x9c', b'"'),   # " left double
    (b'\xe2\x80\x9d', b'"'),   # " right double
    (b'\xe2\x80\x93', b'-'),   # – en dash
    (b'\xe2\x80\x94', b'--'),  # — em dash
    (b'\xe2\x80\xa6', b'...'), # … ellipsis
]

# Matches a single-quoted string that contains an apostrophe followed by a
# letter — the classic 'don't' pattern that breaks tsc.  Never auto-fixed
# because the correct remedy is ambiguous (escape, switch to double quotes,
# or use a template literal).
#
# Pattern: ' ... <letter> ' <letter>
#   - the char immediately BEFORE the inner ' must be a letter (real contraction)
#   - the char immediately AFTER the inner ' must be a letter
# This rejects pairs like '--font-inter', 'swap' where the char before
# closing-quote-of-first-string is not a letter adjacent to the apostrophe.
APOSTROPHE_IN_SINGLE_QUOTE = re.compile(r"'[^'\n]*[a-zA-Z]'[a-zA-Z]")

CHECK_ONLY = '--check' in sys.argv
found = []
apostrophe_warnings = []

for root in ROOTS:
    if not os.path.exists(root):
        continue
    for dp, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next')]
        for f in files:
            if not f.endswith(('.ts', '.tsx', '.cjs', '.js', '.mjs')):
                continue
            p = os.path.join(dp, f)
            content = open(p, 'rb').read()
            fixed = content
            for bad, good in REPLACEMENTS:
                fixed = fixed.replace(bad, good)
            if fixed != content:
                found.append(p)
                if not CHECK_ONLY:
                    open(p, 'wb').write(fixed)
                    print(f'Fixed:   {p}')
                else:
                    print(f'Found:   {p}')

            # Apostrophe-in-single-quoted-string scan (warn only, never auto-fix)
            text = open(p, 'r', encoding='utf-8', errors='ignore').read()
            for i, line in enumerate(text.splitlines(), 1):
                if APOSTROPHE_IN_SINGLE_QUOTE.search(line):
                    apostrophe_warnings.append((p, i, line.strip()))

if CHECK_ONLY and found:
    print(f'\n{len(found)} file(s) contain smart quotes/dashes/ellipsis. Run without --check to fix.')
    sys.exit(1)
elif not found:
    print('No smart quotes found.')
elif not CHECK_ONLY:
    print(f'\nFixed {len(found)} file(s).')

# Apostrophe-in-single-quoted-string warnings: only shown in --check mode.
# In fix mode these are silent — they are legitimate English contractions,
# not bugs, and cannot be auto-fixed without human judgement.
if CHECK_ONLY and apostrophe_warnings:
    for p, i, line in apostrophe_warnings:
        print(f'WARN apostrophe-in-string: {p}:{i}')
        print(f'  {line}')
    print(f'\n{len(apostrophe_warnings)} apostrophe-in-single-quoted-string warning(s) — fix manually.')
