#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$ROOT/dist/output"
OUTPUT_RESOURCE="$ROOT/dist/output_resource"
OUTPUT_STATIC="$ROOT/dist/output_static"

# Map platform env vars to the names expected by the vite preset.
#   MIAODA_APP_ID            -> /app/<appId> client base path (miaoda platform)
#   MIAODA_RESOURCE_CDN_PREFIX -> CDN prefix for JS/CSS assets
# EdgeOne does not inject these -> CLIENT_BASE_PATH is empty -> root deployment.
export CLIENT_BASE_PATH="${MIAODA_APP_ID:+/app/$MIAODA_APP_ID}"
export ASSETS_CDN_PATH="${MIAODA_RESOURCE_CDN_PREFIX:-/}"
export STATIC_ASSETS_BASE_URL="${MIAODA_STATIC_CDN_PREFIX}"
export NODE_ENV="${NODE_ENV:-production}"

# Clean
rm -rf "$ROOT/dist"

# 1. Vite build -> dist/client/
npx vite build --outDir "$ROOT/dist/client" --emptyOutDir

# 2. HTML + public root files -> dist/output/
mkdir -p "$OUTPUT"
find "$ROOT/dist/client" -maxdepth 1 -type f -exec cp {} "$OUTPUT/" \;

# 3. assets/ -> dist/output/assets/ (served alongside HTML at the route path)
#              + dist/output_resource/ (CDN upload dir, if CDN prefix configured)
if [ -d "$ROOT/dist/client/assets" ]; then
  cp -r "$ROOT/dist/client/assets" "$OUTPUT/assets"
  mkdir -p "$OUTPUT_RESOURCE"
  cp -r "$ROOT/dist/client/assets" "$OUTPUT_RESOURCE/"
fi

# 4. Private static assets -> dist/output_static/ (exclude code files)
#    Note: EdgeOne build env has no rsync; use cp + find instead.
if [ -d "$ROOT/shared/static" ]; then
  mkdir -p "$OUTPUT_STATIC"
  cp -r "$ROOT/shared/static/." "$OUTPUT_STATIC/"
  find "$OUTPUT_STATIC" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -delete
fi

# 5. Capability config -> dist/output_capabilities/
if [ -d "$ROOT/shared/capabilities" ]; then
  mkdir -p "$ROOT/dist/output_capabilities"
  cp -r "$ROOT/shared/capabilities/." "$ROOT/dist/output_capabilities/"
fi

# Remove intermediate build output
rm -rf "$ROOT/dist/client"

# 6. Mirror dist/output/ content to dist/ root.
#    EdgeOne StaticAssetsBuilder looks for index.html at dist/ root by default;
#    without this step EdgeOne returns 404. miaoda platform can still use dist/output/.
cp -r "$OUTPUT/." "$ROOT/dist/"

echo "Build complete"
echo "  HTML         -> dist/output/ and dist/ root"
[ -d "$OUTPUT_RESOURCE" ] && echo "  Resource     -> dist/output_resource/" || true
[ -d "$OUTPUT_STATIC" ] && echo "  Static       -> dist/output_static/" || true
[ -d "$ROOT/dist/output_capabilities" ] && echo "  Capabilities -> dist/output_capabilities/" || true
