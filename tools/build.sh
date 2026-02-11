#!/bin/bash
# WebEng Build Script
# Concatenates all source files in dependency order into a single injectable IIFE.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$ROOT_DIR/src"
DIST="$ROOT_DIR/dist"

mkdir -p "$DIST"

OUTPUT="$DIST/webeng.js"

echo "Building WebEng..."

# Write the opening IIFE wrapper
cat > "$OUTPUT" << 'HEADER'
/**
 * WebEng v1.0 — Browser Game Value Modifier Engine
 * Inject this script into any web game page to scan, modify, and freeze
 * in-game values, intercept network traffic, and bypass anti-tamper protections.
 *
 * Usage:
 *   1. Open browser DevTools console on the game page
 *   2. Paste this entire script and press Enter
 *   3. The WebEng panel will appear in the top-right corner
 *   4. Press Ctrl+Shift+G to toggle visibility
 *
 * Console API:
 *   __WEBENG__.scan(value)          - First scan for a value
 *   __WEBENG__.nextScan(value)      - Narrow results
 *   __WEBENG__.set(path, value)     - Set a value at a path
 *   __WEBENG__.freeze(path, value)  - Freeze a value (continuous re-apply)
 *   __WEBENG__.unfreeze(path)       - Stop freezing
 *   __WEBENG__.addRule({...})       - Add a network interception rule
 *   __WEBENG__.unfreezeObj(obj)     - Create writable proxy for frozen object
 */
HEADER

# Concatenate files in dependency order
cat \
  "$SRC/utils/event-bus.js" \
  "$SRC/utils/logger.js" \
  "$SRC/utils/type-detector.js" \
  "$SRC/core/object-walker.js" \
  "$SRC/core/path-resolver.js" \
  "$SRC/core/scanner.js" \
  "$SRC/core/modifier.js" \
  "$SRC/hooks/hook-manager.js" \
  "$SRC/hooks/xhr-hook.js" \
  "$SRC/hooks/fetch-hook.js" \
  "$SRC/hooks/websocket-hook.js" \
  "$SRC/bypass/freeze-bypass.js" \
  "$SRC/bypass/define-property-bypass.js" \
  "$SRC/bypass/timer-bypass.js" \
  "$SRC/bypass/anti-tamper.js" \
  "$SRC/ui/styles.js" \
  "$SRC/ui/overlay.js" \
  "$SRC/ui/scanner-panel.js" \
  "$SRC/ui/results-panel.js" \
  "$SRC/ui/network-panel.js" \
  "$SRC/ui/settings-panel.js" \
  "$SRC/ui/dashboard.js" \
  "$SRC/main.js" \
  >> "$OUTPUT"

# File size info
SIZE=$(wc -c < "$OUTPUT")
LINES=$(wc -l < "$OUTPUT")
echo "Build complete: $OUTPUT"
echo "  Size: $SIZE bytes ($((SIZE / 1024)) KB)"
echo "  Lines: $LINES"
echo ""
echo "To use: copy the contents of dist/webeng.js and paste into a browser console."
