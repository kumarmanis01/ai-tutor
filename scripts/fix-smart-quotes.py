#!/usr/bin/env python3
"""
scripts/fix-smart-quotes.py
Replaces Unicode smart quotes with ASCII equivalents in all .ts/.tsx files.
Run before every commit or after any AI-assisted code generation.
Usage:
  python3 scripts/fix-smart-quotes.py           # fix all
  python3 scripts/fix-smart-quotes.py --check   # check only, exit 1 if found
"""
import os
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

CHECK_ONLY = '--check' in sys.argv
found = []

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

if CHECK_ONLY and found:
    print(f'\n{len(found)} file(s) contain smart quotes/dashes/ellipsis. Run without --check to fix.')
    sys.exit(1)
elif not found:
    print('No smart quotes found.')
elif not CHECK_ONLY:
    print(f'\nFixed {len(found)} file(s).')
