#!/bin/bash
# WebEng Extension Generator
# Generates a minimal Chrome extension that auto-injects WebEng into all frames,
# bypassing cross-origin iframe restrictions entirely.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DIST="$ROOT_DIR/dist"
EXT_DIR="$DIST/webeng-extension"

# Build the main script first if needed
if [ ! -f "$DIST/webeng.js" ]; then
  echo "Building WebEng first..."
  bash "$SCRIPT_DIR/build.sh"
fi

# Clean and create extension directory
rm -rf "$EXT_DIR"
mkdir -p "$EXT_DIR"

# Generate manifest.json (Manifest V3)
cat > "$EXT_DIR/manifest.json" << 'EOF'
{
  "manifest_version": 3,
  "name": "WebEng Game Modifier",
  "version": "1.0",
  "description": "Injects WebEng game value modifier into game portal frames",
  "content_scripts": [
    {
      "matches": [
        "*://*.crazygames.com/*",
        "*://*.poki.com/*",
        "*://*.newgrounds.com/*",
        "*://*.itch.io/*",
        "*://*.itch.zone/*",
        "*://*.kongregate.com/*",
        "*://*.armorgames.com/*",
        "*://*.gamejolt.com/*",
        "*://*.gamedistribution.com/*",
        "*://*.gamemonetize.com/*",
        "*://*.miniclip.com/*",
        "*://*.y8.com/*"
      ],
      "js": ["content.js"],
      "all_frames": true,
      "world": "MAIN",
      "run_at": "document_idle"
    }
  ],
  "icons": {}
}
EOF

# Create content.js with the WebEng script wrapped in a guard
cat > "$EXT_DIR/content.js" << 'HEADER'
// WebEng — Auto-injected via Chrome extension
// Only activates in frames that look like games (have a canvas or game engine globals)
(function() {
  'use strict';

  // Skip if already loaded
  if (window.__WEBENG__) return;

  // In top-level frames, only load if we detect game-related content
  // In sub-frames (iframes), always load since that's where games run
  var isIframe = false;
  try { isIframe = window !== window.top; } catch(e) { isIframe = true; }

  if (!isIframe) {
    // Top-level: wait a bit then check for game iframes before loading
    setTimeout(function() {
      var iframes = document.querySelectorAll('iframe');
      if (iframes.length > 0 || document.querySelectorAll('canvas').length > 0) {
        loadWebEng();
      }
    }, 1500);
  } else {
    // Inside an iframe: wait for game to initialize then load
    setTimeout(function() {
      loadWebEng();
    }, 2000);
  }

  function loadWebEng() {
    if (window.__WEBENG__) return;
HEADER

# Append the actual WebEng script
cat "$DIST/webeng.js" >> "$EXT_DIR/content.js"

# Close the wrapper
cat >> "$EXT_DIR/content.js" << 'FOOTER'
  }
})();
FOOTER

# File size info
SIZE=$(wc -c < "$EXT_DIR/content.js")
echo ""
echo "Extension generated at: $EXT_DIR"
echo "  content.js: $SIZE bytes ($((SIZE / 1024)) KB)"
echo ""
echo "To install:"
echo "  1. Open Chrome and navigate to chrome://extensions"
echo "  2. Enable 'Developer mode' (toggle in top-right)"
echo "  3. Click 'Load unpacked'"
echo "  4. Select the folder: $EXT_DIR"
echo "  5. Navigate to any supported game portal — WebEng will auto-inject"
echo ""
echo "Supported portals:"
echo "  CrazyGames, Poki, Newgrounds, itch.io, Kongregate,"
echo "  Armor Games, GameJolt, Game Distribution, Miniclip, Y8"
