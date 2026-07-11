#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Clean
rm -rf "$ROOT/dist"

# 1. Vite build -> dist/
npx vite build --outDir "$ROOT/dist" --emptyOutDir

# 2. EdgeOne StaticAssetsBuilder expects index.html at dist/ root, which Vite
#    already outputs there. The _redirects file in public/ is copied by Vite
#    automatically and provides SPA fallback routing.
#    For Vercel, vercel.json handles rewrites separately.

echo "Build complete"
echo "  Output -> dist/"
