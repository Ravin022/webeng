/**
 * WebEng ContextDetector — detect execution context (top-level vs iframe),
 * identify known game portals, and locate cross-origin iframes.
 */
(function () {
  'use strict';

  var PORTALS = [
    { name: 'CrazyGames', pattern: /crazygames\.com$/i },
    { name: 'Poki', pattern: /poki\.com$/i },
    { name: 'Newgrounds', pattern: /newgrounds\.com$/i },
    { name: 'itch.io', pattern: /itch\.(io|zone)$/i },
    { name: 'Kongregate', pattern: /kongregate\.com$/i },
    { name: 'Armor Games', pattern: /armorgames\.com$/i },
    { name: 'GameJolt', pattern: /gamejolt\.com$/i },
    { name: 'Game Distribution', pattern: /gamedistribution\.com$/i },
    { name: 'Game Monetize', pattern: /gamemonetize\.com$/i },
    { name: 'Games.co.id', pattern: /games\.co\.id$/i },
    { name: 'Miniclip', pattern: /miniclip\.com$/i },
    { name: 'Y8', pattern: /y8\.com$/i }
  ];

  var GAME_GLOBALS = [
    'Module', 'unityInstance', 'gameInstance', 'UnityLoader',
    'Phaser', 'cc', 'PIXI', 'THREE', 'Godot', 'gdjs',
    'BABYLON', 'createjs', 'Crafty', 'enchant', 'ImpactGame'
  ];

  var ContextDetector = {
    /**
     * Returns 'top' | 'same-origin-iframe' | 'cross-origin-iframe'
     */
    detectContext: function () {
      try {
        if (window === window.top) return 'top';
      } catch (e) {
        // Accessing window.top threw — we're in a cross-origin iframe
        return 'cross-origin-iframe';
      }

      // We're in an iframe. Check if same-origin:
      try {
        // If we can read top.document, it's same-origin
        if (window.top.document) {
          return 'same-origin-iframe';
        }
      } catch (e) {
        // Can't access — cross-origin
      }
      return 'cross-origin-iframe';
    },

    /**
     * Returns true if running inside any iframe.
     */
    isIframe: function () {
      try {
        return window !== window.top;
      } catch (e) {
        return true; // cross-origin throws → we're in an iframe
      }
    },

    /**
     * Returns true if running at the top level.
     */
    isTopLevel: function () {
      try {
        return window === window.top;
      } catch (e) {
        return false;
      }
    },

    /**
     * Detect if the current page is a known game portal.
     * Returns { name: string } or null.
     */
    detectPortal: function () {
      var hostname = '';
      try { hostname = window.location.hostname; } catch (e) { return null; }
      for (var i = 0; i < PORTALS.length; i++) {
        if (PORTALS[i].pattern.test(hostname)) {
          return { name: PORTALS[i].name };
        }
      }
      return null;
    },

    /**
     * Find all cross-origin iframes on the current page.
     * Returns array of { index, src, origin, width, height } sorted by area desc.
     */
    getCrossOriginIframes: function () {
      var iframes = document.querySelectorAll('iframe');
      var results = [];

      for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i];
        var isCrossOrigin = false;

        try {
          var cw = iframe.contentWindow;
          if (cw && cw.document) {
            // Same-origin — skip
            continue;
          }
        } catch (e) {
          isCrossOrigin = true;
        }

        if (!isCrossOrigin) continue;

        var src = iframe.src || '';
        if (!src || src === 'about:blank') continue;

        var origin = '';
        try { origin = new URL(src).origin; } catch (e) { /* ignore */ }

        var w = 0, h = 0;
        try {
          w = iframe.offsetWidth || iframe.clientWidth || 0;
          h = iframe.offsetHeight || iframe.clientHeight || 0;
        } catch (e) { /* ignore */ }

        results.push({
          index: i,
          src: src,
          origin: origin,
          width: w,
          height: h,
          area: w * h
        });
      }

      // Sort by area descending — largest is most likely the game
      results.sort(function (a, b) { return b.area - a.area; });

      return results;
    },

    /**
     * Heuristic: does the current frame look like it contains a game?
     * Checks for canvas elements and known game engine globals.
     */
    looksLikeGameFrame: function () {
      // Canvas is a strong signal
      if (document.querySelectorAll('canvas').length > 0) return true;

      // Check for known game engine globals
      for (var i = 0; i < GAME_GLOBALS.length; i++) {
        try {
          if (window[GAME_GLOBALS[i]] !== undefined) return true;
        } catch (e) { /* ignore */ }
      }

      return false;
    },

    /**
     * Get a user-friendly description of the detected iframe URL.
     * Extracts domain and path for display.
     */
    describeIframeUrl: function (src) {
      try {
        var url = new URL(src);
        var display = url.hostname + url.pathname;
        if (display.length > 60) {
          display = display.substring(0, 57) + '...';
        }
        return display;
      } catch (e) {
        return src.length > 60 ? src.substring(0, 57) + '...' : src;
      }
    }
  };

  window.WebEng = window.WebEng || {};
  window.WebEng.ContextDetector = ContextDetector;
})();
