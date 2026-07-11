#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT="$ROOT/dist/output"
OUTPUT_RESOURCE="$ROOT/dist/output_resource"
OUTPUT_STATIC="$ROOT/dist/output_static"

# 映射平台环境变量到 preset 期望的变量名
#   MIAODA_APP_ID            → /app/<appId> 作为客户端 base path
#   MIAODA_RESOURCE_CDN_PREFIX → assets (JS/CSS) 的 CDN 前缀
# CLI 注入约定见 miaoda-cli src/services/deploy/modern/atoms/build.ts

# EdgeOne builder 并不总是注入 MIAODA_APP_ID；从 .spark/meta.json 的 appUrl 中提取作为兜底
if [ -z "${MIAODA_APP_ID:-}" ] && [ -f "$ROOT/.spark/meta.json" ]; then
  MIAODA_APP_ID=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const u=m.appUrl||'';const r=u.match(/\/app\/(app_[a-z0-9]+)/i);process.stdout.write(r?r[1]:'')" "$ROOT/.spark/meta.json" 2>/dev/null || echo "")
fi

export CLIENT_BASE_PATH="${MIAODA_APP_ID:+/app/$MIAODA_APP_ID}"
export ASSETS_CDN_PATH="${MIAODA_RESOURCE_CDN_PREFIX:-/}"
export STATIC_ASSETS_BASE_URL="${MIAODA_STATIC_CDN_PREFIX}"
export NODE_ENV="${NODE_ENV:-production}"

# 清理
rm -rf "$ROOT/dist"

# 1. Vite 构建 → dist/client/（相对于项目根目录输出）
npx vite build --outDir "$ROOT/dist/client" --emptyOutDir

# 2. HTML + 公共文件 → dist/output/（index.html, routes.json, app-icon.svg 等根级文件）
mkdir -p "$OUTPUT"
find "$ROOT/dist/client" -maxdepth 1 -type f ! -name 'assets' -exec cp {} "$OUTPUT/" \;

# 3. assets/ → dist/output/assets/ (随 HTML 一起在路由路径下提供服务)
#           + dist/output_resource/ (CDN 上传统一目录，若配置了 CDN 前缀)
if [ -d "$ROOT/dist/client/assets" ]; then
  cp -r "$ROOT/dist/client/assets" "$OUTPUT/assets"
  mkdir -p "$OUTPUT_RESOURCE"
  cp -r "$ROOT/dist/client/assets" "$OUTPUT_RESOURCE/"
fi

# 4. 私有静态资源 → dist/output_static/（排除代码文件）
#    Note: EdgeOne 构建环境没有 rsync，使用 cp + find 替代
if [ -d "$ROOT/shared/static" ]; then
  mkdir -p "$OUTPUT_STATIC"
  cp -r "$ROOT/shared/static/." "$OUTPUT_STATIC/"
  find "$OUTPUT_STATIC" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) -delete
fi

# 5. capability 配置 → dist/output_capabilities/
if [ -d "$ROOT/shared/capabilities" ]; then
  mkdir -p "$ROOT/dist/output_capabilities"
  cp -r "$ROOT/shared/capabilities/." "$ROOT/dist/output_capabilities/"
fi

# 清理中间产物
rm -rf "$ROOT/dist/client"

echo "Build complete"
echo "  HTML         → dist/output/"
[ -d "$OUTPUT_RESOURCE" ] && echo "  Resource     → dist/output_resource/" || true
[ -d "$OUTPUT_STATIC" ] && echo "  Static       → dist/output_static/" || true
[ -d "$ROOT/dist/output_capabilities" ] && echo "  Capabilities → dist/output_capabilities/" || true
