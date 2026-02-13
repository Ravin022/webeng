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
/**
 * WebEng EventBus — lightweight pub/sub message broker
 */
(function () {
  'use strict';

  class EventBus {
    constructor() {
      this._listeners = new Map();
    }

    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(callback);
      // Return unsubscribe function
      return () => this.off(event, callback);
    }

    off(event, callback) {
      const list = this._listeners.get(event);
      if (list) {
        this._listeners.set(event, list.filter(cb => cb !== callback));
      }
    }

    emit(event, data) {
      const list = this._listeners.get(event);
      if (list) {
        for (const cb of list) {
          try {
            cb(data);
          } catch (e) {
            console.error('[WebEng] EventBus error in handler for "' + event + '":', e);
          }
        }
      }
    }

    once(event, callback) {
      const unsub = this.on(event, (data) => {
        unsub();
        callback(data);
      });
      return unsub;
    }

    clear() {
      this._listeners.clear();
    }
  }

  // Attach to global namespace
  window.WebEng = window.WebEng || {};
  window.WebEng.EventBus = EventBus;
})();
/**
 * WebEng Logger — leveled internal logging
 */
(function () {
  'use strict';

  const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

  class Logger {
    constructor(level) {
      this._level = LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.info;
      this._history = [];
      this._maxHistory = 500;
    }

    setLevel(level) {
      if (LEVELS[level] !== undefined) {
        this._level = LEVELS[level];
      }
    }

    _log(level, prefix, args) {
      const entry = {
        level,
        timestamp: Date.now(),
        message: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
      };
      this._history.push(entry);
      if (this._history.length > this._maxHistory) {
        this._history.shift();
      }
      if (LEVELS[level] >= this._level) {
        console[level === 'debug' ? 'log' : level](prefix, ...args);
      }
    }

    debug(...args) { this._log('debug', '[WebEng DEBUG]', args); }
    info(...args)  { this._log('info',  '[WebEng]', args); }
    warn(...args)  { this._log('warn',  '[WebEng WARN]', args); }
    error(...args) { this._log('error', '[WebEng ERROR]', args); }

    getHistory() {
      return this._history.slice();
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Logger = Logger;
})();
/**
 * WebEng TypeDetector — value type detection and coercion
 */
(function () {
  'use strict';

  const TypeDetector = {
    detect(value) {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (Array.isArray(value)) return 'array';
      if (ArrayBuffer.isView(value)) return 'typedarray';
      return typeof value;
    },

    coerce(value, targetType) {
      switch (targetType) {
        case 'number':
          const n = Number(value);
          return isNaN(n) ? 0 : n;
        case 'string':
          return String(value);
        case 'boolean':
          if (typeof value === 'string') {
            return value === 'true' || value === '1';
          }
          return Boolean(value);
        default:
          return value;
      }
    },

    displayValue(value) {
      const type = this.detect(value);
      switch (type) {
        case 'null': return 'null';
        case 'undefined': return 'undefined';
        case 'string': return '"' + (value.length > 50 ? value.substring(0, 50) + '...' : value) + '"';
        case 'array': return '[Array(' + value.length + ')]';
        case 'typedarray': return '[' + value.constructor.name + '(' + value.length + ')]';
        case 'object': return '{Object}';
        case 'function': return 'function()';
        default: return String(value);
      }
    },

    isScannableType(type) {
      return type === 'number' || type === 'string' || type === 'boolean';
    }
  };

  window.WebEng = window.WebEng || {};
  window.WebEng.TypeDetector = TypeDetector;
})();
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
/**
 * WebEng ObjectWalker — recursive traversal of the window object graph
 */
(function () {
  'use strict';

  // Properties/subtrees to skip (DOM, browser APIs, our own tool)
  const DEFAULT_SKIP = new Set([
    // Browser built-ins that are huge / irrelevant
    'document', 'location', 'navigator', 'chrome', 'performance',
    'caches', 'cookieStore', 'crypto', 'indexedDB', 'speechSynthesis',
    'visualViewport', 'screen', 'styleMedia', 'external', 'history',
    'clientInformation', 'devicePixelRatio', 'toolbar', 'menubar',
    'personalbar', 'scrollbars', 'statusbar', 'locationbar',
    // DOM / CSS
    'CSS', 'CSSStyleDeclaration', 'HTMLElement', 'Element', 'Node',
    'SVGElement', 'DocumentFragment', 'ShadowRoot',
    // Events
    'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent',
    // Frames
    'frames', 'parent', 'top', 'opener', 'self', 'window',
    // Storage
    'localStorage', 'sessionStorage',
    // Our own tool
    '__WEBENG__', 'WebEng',
    // Common noise
    'webkitURL', 'webkitStorageInfo', 'webkitRequestFileSystem',
    'webkitResolveLocalFileSystemURL', 'webkitMediaStream',
    'chrome', 'opr', '__coverage__', '__react', '__vue',
    // Constructor / prototype noise
    'constructor', 'prototype', '__proto__',
    'toString', 'toLocaleString', 'valueOf', 'hasOwnProperty',
    'isPrototypeOf', 'propertyIsEnumerable'
  ]);

  class ObjectWalker {
    constructor(options) {
      options = options || {};
      this.maxDepth = options.maxDepth || 7;
      this.skipKeys = new Set([...DEFAULT_SKIP, ...(options.extraSkip || [])]);
      this.visited = null;
      this.results = [];
      this._aborted = false;
      this._chunkSize = options.chunkSize || 500;
    }

    reset() {
      this.visited = new WeakSet();
      this.results = [];
      this._aborted = false;
    }

    abort() {
      this._aborted = true;
    }

    /**
     * Synchronous walk — fast but may freeze the page on large graphs.
     * Use walkAsync for production scans.
     */
    walk(root, path, depth) {
      root = root || window;
      path = path || 'window';
      depth = depth || 0;

      if (this._aborted) return;
      if (depth > this.maxDepth) return;
      if (root === null || root === undefined) return;

      const rootType = typeof root;
      if (rootType !== 'object' && rootType !== 'function') return;

      // Circular reference protection
      try {
        if (this.visited.has(root)) return;
        this.visited.add(root);
      } catch (e) {
        return;
      }

      // Skip DOM nodes (cross-frame safe: instanceof fails across contexts)
      try {
        if (root instanceof Node) return;
        if (root.nodeType !== undefined && root.nodeName !== undefined &&
            typeof root.appendChild === 'function') return;
      } catch (e) { /* ignore */ }

      var keys;
      try {
        keys = Object.getOwnPropertyNames(root);
      } catch (e) {
        return;
      }

      for (var i = 0; i < keys.length; i++) {
        if (this._aborted) return;

        var key = keys[i];
        if (this.skipKeys.has(key)) continue;

        // Skip numeric keys only on known DOM collections (not plain game objects)
        if (/^\d+$/.test(key) && !Array.isArray(root) && !ArrayBuffer.isView(root)) {
          try {
            if (root instanceof HTMLCollection || root instanceof NodeList ||
                root instanceof DOMTokenList || root instanceof NamedNodeMap ||
                root instanceof CSSRuleList || root instanceof StyleSheetList) {
              continue;
            }
          } catch (e) { /* not a DOM collection — allow the key */ }
        }

        var fullPath = path + '.' + key;
        var value;

        try {
          value = root[key];
        } catch (e) {
          continue;
        }

        var valType = typeof value;

        // Record scannable primitives
        if (valType === 'number' || valType === 'string' || valType === 'boolean') {
          this.results.push({ path: fullPath, value: value, type: valType });
        }

        // Recurse into objects/arrays
        if (valType === 'object' && value !== null) {
          this.walk(value, fullPath, depth + 1);
        }
      }
    }

    /**
     * Async walk — yields to the event loop every chunkSize properties
     * so the game/page stays responsive.
     */
    async walkAsync(root, path, depth, counter) {
      root = root || window;
      path = path || 'window';
      depth = depth || 0;
      counter = counter || { count: 0 };

      if (this._aborted) return;
      if (depth > this.maxDepth) return;
      if (root === null || root === undefined) return;

      var rootType = typeof root;
      if (rootType !== 'object' && rootType !== 'function') return;

      try {
        if (this.visited.has(root)) return;
        this.visited.add(root);
      } catch (e) {
        return;
      }

      // Skip DOM nodes (cross-frame safe)
      try {
        if (root instanceof Node) return;
        if (root.nodeType !== undefined && root.nodeName !== undefined &&
            typeof root.appendChild === 'function') return;
      } catch (e) { /* ignore */ }

      var keys;
      try {
        keys = Object.getOwnPropertyNames(root);
      } catch (e) {
        return;
      }

      for (var i = 0; i < keys.length; i++) {
        if (this._aborted) return;

        var key = keys[i];
        if (this.skipKeys.has(key)) continue;

        // Skip numeric keys only on known DOM collections
        if (/^\d+$/.test(key) && !Array.isArray(root) && !ArrayBuffer.isView(root)) {
          try {
            if (root instanceof HTMLCollection || root instanceof NodeList ||
                root instanceof DOMTokenList || root instanceof NamedNodeMap ||
                root instanceof CSSRuleList || root instanceof StyleSheetList) {
              continue;
            }
          } catch (e) { /* not a DOM collection — allow the key */ }
        }

        var fullPath = path + '.' + key;
        var value;

        try {
          value = root[key];
        } catch (e) {
          continue;
        }

        var valType = typeof value;

        if (valType === 'number' || valType === 'string' || valType === 'boolean') {
          this.results.push({ path: fullPath, value: value, type: valType });
        }

        if (valType === 'object' && value !== null) {
          await this.walkAsync(value, fullPath, depth + 1, counter);
        }

        counter.count++;
        if (counter.count % this._chunkSize === 0) {
          // Yield to event loop
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.ObjectWalker = ObjectWalker;
})();
/**
 * WebEng PathResolver — read/write values by dot-path strings
 */
(function () {
  'use strict';

  var PathResolver = {
    /**
     * Parse a path string into an array of keys.
     * Handles: "window.game.player.health"
     *          "window.game.inventory[0].name"
     *          "window['some-key'].value"
     */
    parsePath: function (path) {
      var parts = [];
      var current = '';
      var inBracket = false;
      var bracketQuote = null;

      for (var i = 0; i < path.length; i++) {
        var ch = path[i];

        if (inBracket) {
          if (bracketQuote && ch === bracketQuote) {
            bracketQuote = null;
            continue;
          }
          if (!bracketQuote && ch === ']') {
            inBracket = false;
            parts.push(current);
            current = '';
            continue;
          }
          current += ch;
        } else {
          if (ch === '.') {
            if (current) parts.push(current);
            current = '';
          } else if (ch === '[') {
            if (current) parts.push(current);
            current = '';
            inBracket = true;
            // Check for quote
            if (path[i + 1] === '"' || path[i + 1] === "'") {
              bracketQuote = path[i + 1];
              i++;
            }
          } else {
            current += ch;
          }
        }
      }
      if (current) parts.push(current);
      return parts;
    },

    /**
     * Determine the root object and starting index for a parsed path.
     * Handles "window.x.y", "iframe[0].x.y", etc.
     */
    _resolveRoot: function (parts) {
      // "window.x.y"
      if (parts[0] === 'window') {
        return { root: window, startIndex: 1 };
      }

      // "iframe[N].x.y" — parsed as ['iframe', 'N', 'x', 'y']
      if (parts[0] === 'iframe' && parts.length > 1 && /^\d+$/.test(parts[1])) {
        var iframeIndex = parseInt(parts[1]);
        var iframes = document.querySelectorAll('iframe');
        if (iframeIndex < iframes.length) {
          try {
            var cw = iframes[iframeIndex].contentWindow;
            if (cw) return { root: cw, startIndex: 2 };
          } catch (e) { /* fall through */ }
        }
        throw new Error('Cannot access iframe[' + iframeIndex + ']');
      }

      // Default: start from window
      return { root: window, startIndex: 0 };
    },

    /**
     * Resolve a path string to the value it points to.
     */
    resolveValue: function (path) {
      // WASM path handling
      var wasmInfo = WebEng.WasmScanner && WebEng.WasmScanner.parsePath(path);
      if (wasmInfo && window.__WEBENG__ && window.__WEBENG__.wasmScanner) {
        var ws = window.__WEBENG__.wasmScanner;
        for (var m = 0; m < ws._modules.length; m++) {
          if (ws._modules[m].name === wasmInfo.moduleName) {
            return ws.readValue(m, wasmInfo.offset, wasmInfo.scanType);
          }
        }
        throw new Error('WASM module not found: ' + wasmInfo.moduleName);
      }

      var parts = this.parsePath(path);
      var resolved = this._resolveRoot(parts);
      var current = resolved.root;

      for (var i = resolved.startIndex; i < parts.length; i++) {
        if (current === null || current === undefined) {
          throw new Error('Cannot resolve path: ' + path + ' (null at depth ' + i + ')');
        }
        current = current[parts[i]];
      }
      return current;
    },

    /**
     * Set a value at the given path. Falls back to Object.defineProperty
     * if direct assignment fails (e.g., frozen/non-writable property).
     * Returns true on success, false on failure.
     */
    setValue: function (path, newValue) {
      // WASM path handling
      var wasmInfo = WebEng.WasmScanner && WebEng.WasmScanner.parsePath(path);
      if (wasmInfo && window.__WEBENG__ && window.__WEBENG__.wasmScanner) {
        var ws = window.__WEBENG__.wasmScanner;
        for (var m = 0; m < ws._modules.length; m++) {
          if (ws._modules[m].name === wasmInfo.moduleName) {
            return ws.writeValue(m, wasmInfo.offset, Number(newValue), wasmInfo.scanType);
          }
        }
        return false;
      }

      var parts = this.parsePath(path);
      var resolved = this._resolveRoot(parts);
      var current = resolved.root;

      // Navigate to the parent of the target property
      for (var i = resolved.startIndex; i < parts.length - 1; i++) {
        if (current === null || current === undefined) {
          return false;
        }
        current = current[parts[i]];
      }

      var lastKey = parts[parts.length - 1];

      // Attempt 1: direct assignment
      try {
        current[lastKey] = newValue;
        if (current[lastKey] === newValue) return true;
      } catch (e) { /* fall through */ }

      // Attempt 2: Object.defineProperty to override non-writable
      try {
        Object.defineProperty(current, lastKey, {
          value: newValue,
          writable: true,
          configurable: true
        });
        return current[lastKey] === newValue;
      } catch (e) { /* fall through */ }

      // Attempt 3: delete and re-assign
      try {
        delete current[lastKey];
        current[lastKey] = newValue;
        return current[lastKey] === newValue;
      } catch (e) {
        return false;
      }
    }
  };

  window.WebEng = window.WebEng || {};
  window.WebEng.PathResolver = PathResolver;
})();
/**
 * WebEng IframeScanner — detect and scan game iframes
 */
(function () {
  'use strict';

  class IframeScanner {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this._iframeContexts = [];
    }

    /**
     * Discover all iframes on the page.
     * Returns array of { index, iframe, contentWindow, accessible, src }
     */
    detectIframes() {
      this._iframeContexts = [];
      var iframes = document.querySelectorAll('iframe');
      var results = [];

      for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i];
        var entry = {
          index: i,
          iframe: iframe,
          contentWindow: null,
          accessible: false,
          src: iframe.src || '(no src)'
        };

        try {
          var cw = iframe.contentWindow;
          // Same-origin test: accessing .document throws on cross-origin
          if (cw && cw.document) {
            entry.contentWindow = cw;
            entry.accessible = true;
          }
        } catch (e) {
          entry.accessible = false;
        }

        results.push(entry);
        this._iframeContexts.push(entry);
      }

      this.eventBus.emit('iframe:detected', {
        total: results.length,
        accessible: results.filter(function (r) { return r.accessible; }).length,
        iframes: results.map(function (r) {
          return { index: r.index, src: r.src, accessible: r.accessible };
        })
      });

      // Emit cross-origin event if any inaccessible iframes found
      var crossOrigin = results.filter(function (r) {
        return !r.accessible && r.src && r.src !== '(no src)';
      });
      if (crossOrigin.length > 0) {
        this.eventBus.emit('iframe:cross-origin-detected', {
          count: crossOrigin.length,
          iframes: this.getCrossOriginInfo()
        });
      }

      return results;
    }

    /**
     * Get accessible iframe contentWindows for scanning.
     */
    getAccessibleContexts() {
      return this._iframeContexts.filter(function (ctx) {
        return ctx.accessible && ctx.contentWindow;
      });
    }

    /**
     * Walk an iframe's object graph using the provided ObjectWalker.
     * Results are tagged with iframe-prefixed paths: "iframe[0].game.player.hp"
     * The walker should NOT be reset before this — we append to existing results.
     */
    async walkIframe(walker, ctx) {
      var prefix = 'iframe[' + ctx.index + ']';
      await walker.walkAsync(ctx.contentWindow, prefix, 0);
    }

    /**
     * Get detected iframe info for display.
     */
    getIframeInfo() {
      return this._iframeContexts.map(function (ctx) {
        return {
          index: ctx.index,
          src: ctx.src,
          accessible: ctx.accessible
        };
      });
    }

    /**
     * Get detailed info about cross-origin (inaccessible) iframes.
     * Returns array sorted by area descending (largest = most likely the game).
     */
    getCrossOriginInfo() {
      return this._iframeContexts
        .filter(function (ctx) { return !ctx.accessible && ctx.src && ctx.src !== '(no src)'; })
        .map(function (ctx) {
          var origin = '';
          try { origin = new URL(ctx.src).origin; } catch (e) { /* ignore */ }
          var area = 0;
          try {
            var w = ctx.iframe.offsetWidth || ctx.iframe.clientWidth || 0;
            var h = ctx.iframe.offsetHeight || ctx.iframe.clientHeight || 0;
            area = w * h;
          } catch (e) { /* ignore */ }
          return { index: ctx.index, src: ctx.src, origin: origin, area: area };
        })
        .sort(function (a, b) { return b.area - a.area; });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.IframeScanner = IframeScanner;
})();
/**
 * WebEng WasmScanner — scan WebAssembly linear memory for game values
 */
(function () {
  'use strict';

  var MAX_RESULTS = 50000;

  class WasmScanner {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this._modules = [];
      this._offsets = [];
      this._scanType = 'i32';
      this._currentModuleIndex = 0;
    }

    /**
     * Search for Emscripten/Unity Module objects in the given window
     * and any accessible iframe contexts.
     */
    detectModules(iframeScanner) {
      this._modules = [];
      var searchRoots = [{ root: window, prefix: '' }];

      // Also search accessible iframes
      if (iframeScanner) {
        var ctxs = iframeScanner.getAccessibleContexts();
        for (var i = 0; i < ctxs.length; i++) {
          searchRoots.push({
            root: ctxs[i].contentWindow,
            prefix: 'iframe[' + ctxs[i].index + '].'
          });
        }
      }

      for (var s = 0; s < searchRoots.length; s++) {
        var w = searchRoots[s].root;
        var pfx = searchRoots[s].prefix;
        this._checkCandidate(w, pfx + 'Module', w.Module);
        this._checkCandidate(w, pfx + 'unityInstance', w.unityInstance);
        this._checkCandidate(w, pfx + 'gameInstance', w.gameInstance);

        // Unity 2020+ pattern
        try {
          if (w.unityInstance && w.unityInstance.Module) {
            this._checkCandidate(w, pfx + 'unityInstance.Module', w.unityInstance.Module);
          }
        } catch (e) { /* ignore */ }

        // Try _Module (some Emscripten builds)
        this._checkCandidate(w, pfx + '_Module', w._Module);

        // Walk top-level looking for any object with HEAP32
        try {
          var keys = Object.getOwnPropertyNames(w);
          for (var k = 0; k < keys.length; k++) {
            if (keys[k] === '__WEBENG__' || keys[k] === 'WebEng') continue;
            try {
              var obj = w[keys[k]];
              if (obj && typeof obj === 'object' && obj.HEAP32 && obj.HEAP32.buffer) {
                this._checkCandidate(w, pfx + keys[k], obj);
              }
            } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      }

      this.eventBus.emit('wasm:detected', {
        count: this._modules.length,
        modules: this._modules.map(function (m) {
          return { name: m.name, heapSize: m.heapBuffer.byteLength };
        })
      });

      return this._modules;
    }

    _checkCandidate(win, name, obj) {
      if (!obj || typeof obj !== 'object') return;

      // Avoid duplicates by checking heapBuffer identity
      var heapBuffer = null;
      try {
        if (obj.HEAP32 && obj.HEAP32.buffer instanceof ArrayBuffer) {
          heapBuffer = obj.HEAP32.buffer;
        } else if (obj.wasmMemory && obj.wasmMemory.buffer instanceof ArrayBuffer) {
          heapBuffer = obj.wasmMemory.buffer;
        } else if (obj.asm && obj.asm.memory && obj.asm.memory.buffer instanceof ArrayBuffer) {
          heapBuffer = obj.asm.memory.buffer;
        }
      } catch (e) { return; }

      if (!heapBuffer) return;

      // Check for duplicates
      for (var i = 0; i < this._modules.length; i++) {
        if (this._modules[i].heapBuffer === heapBuffer) return;
      }

      this._modules.push({
        name: name,
        module: obj,
        heapBuffer: heapBuffer
      });
    }

    /**
     * Get a fresh buffer reference (handles WASM memory growth).
     */
    _getFreshBuffer(moduleIndex) {
      var mod = this._modules[moduleIndex];
      if (!mod) return null;

      // Re-read in case memory.grow() was called
      try {
        if (mod.module.HEAP32 && mod.module.HEAP32.buffer) {
          mod.heapBuffer = mod.module.HEAP32.buffer;
        } else if (mod.module.wasmMemory && mod.module.wasmMemory.buffer) {
          mod.heapBuffer = mod.module.wasmMemory.buffer;
        }
      } catch (e) { /* keep existing */ }

      return mod.heapBuffer;
    }

    /**
     * First scan: scan the entire WASM heap for a target value.
     */
    firstScan(targetValue, scanType, tolerance, moduleIndex) {
      moduleIndex = moduleIndex || 0;
      scanType = scanType || 'i32';
      tolerance = tolerance || 0;
      this._scanType = scanType;
      this._currentModuleIndex = moduleIndex;
      this._offsets = [];

      if (this._modules.length === 0) return [];

      var buffer = this._getFreshBuffer(moduleIndex);
      if (!buffer) return [];

      var mod = this._modules[moduleIndex];
      var results = [];

      if (scanType === 'i32') {
        var heap32 = new Int32Array(buffer);
        var targetI = targetValue | 0;
        for (var i = 0; i < heap32.length && results.length < MAX_RESULTS; i++) {
          if (heap32[i] === targetI) {
            results.push({ offset: i * 4, value: heap32[i], type: 'i32' });
          }
        }
      } else if (scanType === 'f32') {
        var heapF32 = new Float32Array(buffer);
        var eps32 = tolerance || 0.01;
        for (var fi = 0; fi < heapF32.length && results.length < MAX_RESULTS; fi++) {
          if (Math.abs(heapF32[fi] - targetValue) <= eps32) {
            results.push({ offset: fi * 4, value: heapF32[fi], type: 'f32' });
          }
        }
      } else if (scanType === 'f64') {
        var heapF64 = new Float64Array(buffer);
        var eps64 = tolerance || 0.001;
        for (var di = 0; di < heapF64.length && results.length < MAX_RESULTS; di++) {
          if (Math.abs(heapF64[di] - targetValue) <= eps64) {
            results.push({ offset: di * 8, value: heapF64[di], type: 'f64' });
          }
        }
      }

      this._offsets = results;

      // Convert to scanner-compatible format
      var modName = mod.name;
      var st = scanType;
      return results.map(function (r) {
        return {
          path: 'wasm[' + modName + '].heap' + st + '[0x' + r.offset.toString(16) + ']',
          value: r.value,
          type: 'number',
          previousValue: r.value,
          _wasmOffset: r.offset,
          _wasmType: r.type,
          _wasmModuleIndex: moduleIndex
        };
      });
    }

    /**
     * Next scan: re-read at previously found offsets and filter.
     */
    nextScan(targetValue, comparator, tolerance) {
      if (this._modules.length === 0 || this._offsets.length === 0) return [];

      var buffer = this._getFreshBuffer(this._currentModuleIndex);
      if (!buffer) return [];

      var mod = this._modules[this._currentModuleIndex];
      var scanType = this._scanType;
      var eps = tolerance || (scanType === 'i32' ? 0 : 0.01);
      var filtered = [];

      for (var i = 0; i < this._offsets.length; i++) {
        var entry = this._offsets[i];
        var currentValue;

        try {
          if (scanType === 'i32') {
            currentValue = new Int32Array(buffer)[entry.offset / 4];
          } else if (scanType === 'f32') {
            currentValue = new Float32Array(buffer)[entry.offset / 4];
          } else if (scanType === 'f64') {
            currentValue = new Float64Array(buffer)[entry.offset / 8];
          }
        } catch (e) {
          continue;
        }

        var match = false;
        switch (comparator) {
          case 'exact':
            if (scanType === 'i32') {
              match = (currentValue === (targetValue | 0));
            } else {
              match = Math.abs(currentValue - targetValue) <= eps;
            }
            break;
          case 'changed':
            match = currentValue !== entry.value;
            break;
          case 'unchanged':
            match = currentValue === entry.value;
            break;
          case 'increased':
            match = currentValue > entry.value;
            break;
          case 'decreased':
            match = currentValue < entry.value;
            break;
          case 'greater':
            match = currentValue > targetValue;
            break;
          case 'less':
            match = currentValue < targetValue;
            break;
          default:
            match = currentValue == targetValue;
        }

        if (match) {
          filtered.push({
            offset: entry.offset,
            value: currentValue,
            type: entry.type
          });
        }
      }

      this._offsets = filtered;

      var modName = mod.name;
      var st = scanType;
      var modIdx = this._currentModuleIndex;
      return filtered.map(function (r) {
        return {
          path: 'wasm[' + modName + '].heap' + st + '[0x' + r.offset.toString(16) + ']',
          value: r.value,
          type: 'number',
          previousValue: r.value,
          _wasmOffset: r.offset,
          _wasmType: r.type,
          _wasmModuleIndex: modIdx
        };
      });
    }

    /**
     * Write a value to WASM memory at a specific byte offset.
     */
    writeValue(moduleIndex, offset, value, scanType) {
      var buffer = this._getFreshBuffer(moduleIndex);
      if (!buffer) return false;

      try {
        if (scanType === 'i32') {
          new Int32Array(buffer)[offset / 4] = value | 0;
        } else if (scanType === 'f32') {
          new Float32Array(buffer)[offset / 4] = +value;
        } else if (scanType === 'f64') {
          new Float64Array(buffer)[offset / 8] = +value;
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    /**
     * Read a value from WASM memory at a specific byte offset.
     */
    readValue(moduleIndex, offset, scanType) {
      var buffer = this._getFreshBuffer(moduleIndex);
      if (!buffer) return undefined;

      try {
        if (scanType === 'i32') {
          return new Int32Array(buffer)[offset / 4];
        } else if (scanType === 'f32') {
          return new Float32Array(buffer)[offset / 4];
        } else if (scanType === 'f64') {
          return new Float64Array(buffer)[offset / 8];
        }
      } catch (e) {
        return undefined;
      }
    }

    /**
     * Parse a WASM path string like "wasm[Module].heapi32[0x1a2b]"
     */
    static parsePath(path) {
      var match = path.match(
        /^wasm\[([^\]]+)\]\.heap(i32|f32|f64)\[0x([0-9a-fA-F]+)\]$/
      );
      if (!match) return null;
      return {
        moduleName: match[1],
        scanType: match[2],
        offset: parseInt(match[3], 16)
      };
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.WasmScanner = WasmScanner;
})();
/**
 * WebEng EngineDetector — detect common game engine patterns
 */
(function () {
  'use strict';

  var ENGINE_SIGNATURES = [
    {
      name: 'Unity WebGL',
      detect: function (w) {
        return !!(w.unityInstance || w.UnityLoader ||
                  w.gameInstance ||
                  (w.Module && w.Module.canvas && w.Module.HEAP32));
      },
      hasWasm: true,
      tips: 'Use WASM scanning (Int32 or Float32). State lives in Module.HEAP32/HEAPF32.'
    },
    {
      name: 'Phaser',
      detect: function (w) {
        return !!(w.Phaser || (w.game && w.game.scene));
      },
      hasWasm: false,
      tips: 'Game state often in game.scene.scenes[0].data or game.registry.'
    },
    {
      name: 'Construct 3',
      detect: function (w) {
        return !!(w.cr_getC2Runtime || w.C3 || w.c3_runtimeInterface);
      },
      hasWasm: true,
      tips: 'Try scanning JS variables. Also supports WASM scanning.'
    },
    {
      name: 'PixiJS',
      detect: function (w) {
        return !!(w.PIXI);
      },
      hasWasm: false,
      tips: 'Game state in application objects, not PIXI itself. Use JS scanning.'
    },
    {
      name: 'Three.js',
      detect: function (w) {
        return !!(w.THREE);
      },
      hasWasm: false,
      tips: 'Look for scene/renderer objects. State may be in userData properties.'
    },
    {
      name: 'Godot',
      detect: function (w) {
        return !!((w.Engine && w.Engine.isWebGLAvailable) || w.Godot);
      },
      hasWasm: true,
      tips: 'Godot uses WASM. Use WASM scanning for game state.'
    },
    {
      name: 'GDevelop',
      detect: function (w) {
        return !!(w.gdjs || w.runtimeScene);
      },
      hasWasm: false,
      tips: 'State in gdjs.RuntimeGame or runtimeScene variables.'
    },
    {
      name: 'Emscripten',
      detect: function (w) {
        return !!(w.Module && (w.Module.HEAP32 || w.Module.wasmMemory));
      },
      hasWasm: true,
      tips: 'WASM memory available via Module.HEAP32/HEAPF32. Use WASM scanning.'
    }
  ];

  var EngineDetector = {
    /**
     * Detect engines in the given window context.
     */
    detect: function (targetWindow) {
      targetWindow = targetWindow || window;
      var found = [];

      for (var i = 0; i < ENGINE_SIGNATURES.length; i++) {
        var sig = ENGINE_SIGNATURES[i];
        try {
          if (sig.detect(targetWindow)) {
            found.push({
              name: sig.name,
              hasWasm: sig.hasWasm,
              tips: sig.tips
            });
          }
        } catch (e) { /* skip */ }
      }
      return found;
    },

    /**
     * Detect engines across main window and all accessible iframes.
     */
    detectAll: function (iframeScanner) {
      var results = [];

      // Check main window
      var mainEngines = this.detect(window);
      for (var i = 0; i < mainEngines.length; i++) {
        mainEngines[i].context = 'window';
        results.push(mainEngines[i]);
      }

      // Check accessible iframes
      if (iframeScanner) {
        var ctxs = iframeScanner.getAccessibleContexts();
        for (var j = 0; j < ctxs.length; j++) {
          try {
            var iframeEngines = this.detect(ctxs[j].contentWindow);
            for (var k = 0; k < iframeEngines.length; k++) {
              iframeEngines[k].context = 'iframe[' + ctxs[j].index + ']';
              results.push(iframeEngines[k]);
            }
          } catch (e) { /* cross-origin, skip */ }
        }
      }

      return results;
    }
  };

  window.WebEng = window.WebEng || {};
  window.WebEng.EngineDetector = EngineDetector;
})();
/**
 * WebEng Scanner — first scan / next scan workflow with comparators
 * Integrates JS object scanning, iframe scanning, and WASM memory scanning.
 */
(function () {
  'use strict';

  class Scanner {
    constructor(objectWalker, pathResolver, eventBus, options) {
      options = options || {};
      this.walker = objectWalker;
      this.pathResolver = pathResolver;
      this.eventBus = eventBus;

      this.iframeScanner = options.iframeScanner || null;
      this.wasmScanner = options.wasmScanner || null;

      this.scanResults = [];
      this.wasmResults = [];
      this.scanCount = 0;
      this.isScanning = false;

      // Configurable from UI
      this.scanIframes = true;
      this.scanWasm = true;
      this.tolerance = 0;
      this.wasmScanType = 'auto'; // 'auto', 'i32', 'f32', 'f64'
    }

    /**
     * First scan: walk the entire object graph (+ iframes + WASM) and filter.
     */
    async firstScan(targetValue, targetType, comparator) {
      this.scanCount = 1;
      this.isScanning = true;
      this.wasmResults = [];
      this.eventBus.emit('scan:start', { scanNumber: 1 });

      // 1. Walk the main window object graph
      this.walker.reset();
      await this.walker.walkAsync();

      // 2. Walk accessible iframes
      if (this.scanIframes && this.iframeScanner) {
        try {
          this.iframeScanner.detectIframes();
          var contexts = this.iframeScanner.getAccessibleContexts();
          for (var c = 0; c < contexts.length; c++) {
            await this.iframeScanner.walkIframe(this.walker, contexts[c]);
          }
        } catch (e) {
          // Iframe scanning failed — continue with what we have
        }
      }

      // 3. Filter JS results
      var allResults = this.walker.results;
      var filtered = [];

      for (var i = 0; i < allResults.length; i++) {
        var entry = allResults[i];

        // Type filter
        if (targetType && targetType !== 'any' && entry.type !== targetType) {
          continue;
        }

        if (this._compare(entry.value, targetValue, entry.type, comparator)) {
          filtered.push({
            path: entry.path,
            value: entry.value,
            type: entry.type,
            previousValue: entry.value
          });
        }
      }

      // 4. WASM memory scan
      if (this.scanWasm && this.wasmScanner) {
        try {
          this.wasmScanner.detectModules(this.iframeScanner);
          var numVal = Number(targetValue);

          if (!isNaN(numVal) && (targetType === 'number' || targetType === 'any')) {
            // Determine scan type
            var wasmType = this.wasmScanType;
            if (wasmType === 'auto') {
              wasmType = Number.isInteger(numVal) ? 'i32' : 'f32';
            }

            var wasmHits = this.wasmScanner.firstScan(
              numVal, wasmType, this.tolerance || (wasmType === 'i32' ? 0 : 0.01), 0
            );

            this.wasmResults = wasmHits;

            // Append to filtered results
            for (var w = 0; w < wasmHits.length; w++) {
              filtered.push(wasmHits[w]);
            }
          }
        } catch (e) {
          // WASM scanning failed — continue with JS results
        }
      }

      this.scanResults = filtered;
      this.isScanning = false;

      this.eventBus.emit('scan:complete', {
        scanNumber: this.scanCount,
        resultCount: filtered.length,
        results: filtered.slice(0, 2000)
      });

      return this.scanResults;
    }

    /**
     * Next scan: re-read values at previously found paths, filter again.
     */
    async nextScan(targetValue, comparator) {
      this.scanCount++;
      this.isScanning = true;
      this.eventBus.emit('scan:start', { scanNumber: this.scanCount });

      var filtered = [];

      // Re-check JS/iframe results
      for (var i = 0; i < this.scanResults.length; i++) {
        var entry = this.scanResults[i];

        // Skip WASM entries — handled separately below
        if (entry._wasmOffset !== undefined) continue;

        var currentValue;
        try {
          currentValue = this.pathResolver.resolveValue(entry.path);
        } catch (e) {
          continue; // Path no longer valid
        }

        var shouldInclude = false;

        // For relative comparators, compare against previous value
        if (comparator === 'changed') {
          shouldInclude = currentValue !== entry.value;
        } else if (comparator === 'unchanged') {
          shouldInclude = currentValue === entry.value;
        } else if (comparator === 'increased') {
          shouldInclude = Number(currentValue) > Number(entry.value);
        } else if (comparator === 'decreased') {
          shouldInclude = Number(currentValue) < Number(entry.value);
        } else {
          shouldInclude = this._compare(currentValue, targetValue, entry.type, comparator);
        }

        if (shouldInclude) {
          filtered.push({
            path: entry.path,
            value: currentValue,
            type: entry.type,
            previousValue: entry.value
          });
        }
      }

      // Re-scan WASM offsets
      if (this.wasmScanner && this.wasmResults.length > 0) {
        try {
          var wasmFiltered = this.wasmScanner.nextScan(
            Number(targetValue), comparator, this.tolerance
          );
          this.wasmResults = wasmFiltered;

          for (var w = 0; w < wasmFiltered.length; w++) {
            filtered.push(wasmFiltered[w]);
          }
        } catch (e) {
          // WASM re-scan failed
        }
      }

      this.scanResults = filtered;
      this.isScanning = false;

      this.eventBus.emit('scan:complete', {
        scanNumber: this.scanCount,
        resultCount: filtered.length,
        results: filtered.slice(0, 2000)
      });

      return this.scanResults;
    }

    /**
     * Reset scan state.
     */
    reset() {
      this.scanResults = [];
      this.wasmResults = [];
      this.scanCount = 0;
      this.isScanning = false;
      this.eventBus.emit('scan:reset');
    }

    /**
     * Compare a value against the target using the given comparator.
     */
    _compare(actual, target, type, comparator) {
      var a = actual;
      var t = target;

      // Coerce for numeric comparison
      if (type === 'number' || typeof actual === 'number') {
        a = Number(actual);
        t = Number(target);
        if (isNaN(t)) return false;
      }

      switch (comparator) {
        case 'exact':
          if (type === 'string') return String(a) === String(t);
          // Float tolerance for numeric comparison
          if (this.tolerance > 0 && typeof a === 'number') {
            return Math.abs(a - t) <= this.tolerance;
          }
          return a === t;
        case 'greater':
          return a > t;
        case 'less':
          return a < t;
        case 'not_equal':
          return a !== t;
        case 'between':
          var bounds = String(target).split(',');
          if (bounds.length === 2) {
            return a >= Number(bounds[0]) && a <= Number(bounds[1]);
          }
          return false;
        default:
          return a == t;
      }
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Scanner = Scanner;
})();
/**
 * WebEng Modifier — set values and freeze/unfreeze them
 */
(function () {
  'use strict';

  class Modifier {
    constructor(pathResolver, eventBus) {
      this.pathResolver = pathResolver;
      this.eventBus = eventBus;
      this.frozenValues = new Map(); // path -> { value, intervalId }
      this.bookmarks = [];           // saved paths for quick access
    }

    /**
     * Set a value at the given path with optional type coercion.
     */
    setValue(path, newValue, targetType) {
      if (targetType) {
        newValue = WebEng.TypeDetector.coerce(newValue, targetType);
      } else {
        // Auto-detect from current value type
        try {
          var current = this.pathResolver.resolveValue(path);
          var currentType = typeof current;
          if (currentType === 'number') {
            newValue = Number(newValue);
          } else if (currentType === 'boolean') {
            newValue = (newValue === 'true' || newValue === true || newValue === '1');
          }
        } catch (e) { /* use as-is */ }
      }

      var success = this.pathResolver.setValue(path, newValue);
      this.eventBus.emit('value:modified', { path: path, newValue: newValue, success: success });
      return success;
    }

    /**
     * Freeze a value — continuously re-apply it every 50ms.
     */
    freeze(path, value) {
      // Clear existing freeze on this path
      if (this.frozenValues.has(path)) {
        this.unfreeze(path);
      }

      var self = this;
      var intervalId = setInterval(function () {
        self.pathResolver.setValue(path, value);
      }, 50);

      this.frozenValues.set(path, { value: value, intervalId: intervalId });
      this.eventBus.emit('value:frozen', { path: path, value: value });
    }

    /**
     * Stop freezing a value.
     */
    unfreeze(path) {
      var entry = this.frozenValues.get(path);
      if (entry) {
        clearInterval(entry.intervalId);
        this.frozenValues.delete(path);
        this.eventBus.emit('value:unfrozen', { path: path });
      }
    }

    /**
     * Check if a path is currently frozen.
     */
    isFrozen(path) {
      return this.frozenValues.has(path);
    }

    /**
     * Get all frozen paths with their values.
     */
    getFrozenList() {
      var list = [];
      this.frozenValues.forEach(function (entry, path) {
        list.push({ path: path, value: entry.value });
      });
      return list;
    }

    /**
     * Unfreeze all values.
     */
    unfreezeAll() {
      var self = this;
      this.frozenValues.forEach(function (entry, path) {
        clearInterval(entry.intervalId);
      });
      this.frozenValues.clear();
      this.eventBus.emit('value:allUnfrozen');
    }

    /**
     * Bookmark a path for quick future access.
     */
    addBookmark(path, label) {
      this.bookmarks.push({
        path: path,
        label: label || path.split('.').pop(),
        created: Date.now()
      });
      this.eventBus.emit('bookmark:added', { path: path, label: label });
    }

    /**
     * Remove a bookmark by path.
     */
    removeBookmark(path) {
      this.bookmarks = this.bookmarks.filter(function (b) { return b.path !== path; });
      this.eventBus.emit('bookmark:removed', { path: path });
    }

    /**
     * Get all bookmarks with current values.
     */
    getBookmarks() {
      var self = this;
      return this.bookmarks.map(function (b) {
        var value;
        try {
          value = self.pathResolver.resolveValue(b.path);
        } catch (e) {
          value = '<error>';
        }
        return { path: b.path, label: b.label, value: value, created: b.created };
      });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Modifier = Modifier;
})();
/**
 * WebEng PostMessageBridge — enables communication between WebEng instances
 * running in different frame contexts (parent page <-> game iframe).
 * Uses a unique protocol key to avoid collision with game SDKs (Poki, CrazyGames, etc.).
 */
(function () {
  'use strict';

  var PROTOCOL = '__WEBENG_BRIDGE__';
  var VERSION = 1;

  class PostMessageBridge {
    constructor(eventBus, role) {
      this.eventBus = eventBus;
      this.role = role; // 'parent' or 'iframe'
      this._handler = this._onMessage.bind(this);
      this._peerReady = false;
      this._nextMsgId = 1;
    }

    /**
     * Start listening for messages and announce presence.
     */
    start() {
      window.addEventListener('message', this._handler);
      this._broadcast({ type: 'handshake', role: this.role });

      // Re-send handshake after a short delay in case peer loaded later
      var self = this;
      setTimeout(function () {
        if (!self._peerReady) {
          self._broadcast({ type: 'handshake', role: self.role });
        }
      }, 3000);
    }

    /**
     * Stop listening.
     */
    stop() {
      window.removeEventListener('message', this._handler);
    }

    /**
     * Send a message to the peer.
     */
    _broadcast(payload) {
      var msg = {
        protocol: PROTOCOL,
        version: VERSION,
        id: this._nextMsgId++,
        payload: payload
      };

      if (this.role === 'parent') {
        // Send to all iframes
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
          try {
            iframes[i].contentWindow.postMessage(msg, '*');
          } catch (e) { /* cross-origin postMessage still works */ }
        }
      } else {
        // Send to parent
        try {
          window.parent.postMessage(msg, '*');
        } catch (e) { /* ignore */ }
      }
    }

    /**
     * Handle incoming messages.
     */
    _onMessage(event) {
      var data = event.data;
      if (!data || data.protocol !== PROTOCOL) return;
      if (data.version !== VERSION) return;

      var payload = data.payload;
      if (!payload) return;

      // Ignore messages from same role
      if (payload.role === this.role) return;

      switch (payload.type) {
        case 'handshake':
          this._peerReady = true;
          this._broadcast({ type: 'handshake-ack', role: this.role });
          this.eventBus.emit('bridge:connected', { peerRole: payload.role });
          break;

        case 'handshake-ack':
          this._peerReady = true;
          this.eventBus.emit('bridge:connected', { peerRole: payload.role });
          break;

        case 'scan-results':
          this.eventBus.emit('bridge:scan-results', {
            results: payload.results || [],
            scanNumber: payload.scanNumber
          });
          break;

        case 'command':
          this._handleCommand(payload);
          break;

        case 'status':
          this.eventBus.emit('bridge:status', { text: payload.text });
          break;
      }
    }

    /**
     * Send scan results from iframe to parent.
     */
    sendScanResults(results, scanNumber) {
      this._broadcast({
        type: 'scan-results',
        results: results.map(function (r) {
          return { path: r.path, value: r.value, type: r.type };
        }).slice(0, 500), // Limit for postMessage serialization
        scanNumber: scanNumber
      });
    }

    /**
     * Send a command from parent to iframe.
     */
    sendCommand(cmd, args) {
      this._broadcast({
        type: 'command',
        cmd: cmd,
        args: args
      });
    }

    /**
     * Send a status message to the peer.
     */
    sendStatus(text) {
      this._broadcast({ type: 'status', text: text });
    }

    /**
     * Handle commands received from the peer.
     */
    _handleCommand(payload) {
      var webeng = window.__WEBENG__;
      if (!webeng) return;

      var self = this;
      switch (payload.cmd) {
        case 'scan':
          webeng.scan(payload.args.value, payload.args.type, payload.args.comparator)
            .then(function () {
              var results = webeng.scanner.lastResults || [];
              self.sendScanResults(results, webeng.scanner.scanCount);
              self.sendStatus('Scan complete: ' + results.length + ' result(s)');
            });
          break;

        case 'nextScan':
          webeng.nextScan(payload.args.value, payload.args.comparator)
            .then(function () {
              var results = webeng.scanner.lastResults || [];
              self.sendScanResults(results, webeng.scanner.scanCount);
              self.sendStatus('Next scan: ' + results.length + ' result(s)');
            });
          break;

        case 'set':
          webeng.set(payload.args.path, payload.args.value);
          self.sendStatus('Value set: ' + payload.args.path);
          break;

        case 'freeze':
          webeng.freeze(payload.args.path, payload.args.value);
          self.sendStatus('Frozen: ' + payload.args.path);
          break;

        case 'unfreeze':
          webeng.unfreeze(payload.args.path);
          self.sendStatus('Unfrozen: ' + payload.args.path);
          break;
      }
    }

    /**
     * Check if peer is connected.
     */
    isPeerReady() {
      return this._peerReady;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.PostMessageBridge = PostMessageBridge;
})();
/**
 * WebEng HookManager — central registry for network interception rules and logging
 */
(function () {
  'use strict';

  class HookManager {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.rules = [];
      this.requestLog = [];
      this.wsLog = [];
      this._maxLog = 500;
      this._nextRuleId = 1;
    }

    /**
     * Add a modification rule.
     * @param {Object} rule - { name, urlPattern, target, action, find, replace, enabled }
     *   urlPattern: string (will be compiled to regex)
     *   target: 'request' | 'response'
     *   action: 'modify' | 'block' | 'delay'
     *   find: string or regex pattern to find in body
     *   replace: string to replace with
     */
    addRule(rule) {
      var compiled = {
        id: this._nextRuleId++,
        name: rule.name || 'Rule ' + this._nextRuleId,
        urlPattern: rule.urlPattern || '.*',
        urlRegex: null,
        target: rule.target || 'response',
        action: rule.action || 'modify',
        find: rule.find || '',
        replace: rule.replace !== undefined ? rule.replace : '',
        enabled: rule.enabled !== false
      };

      try {
        compiled.urlRegex = new RegExp(compiled.urlPattern);
      } catch (e) {
        compiled.urlRegex = new RegExp('.*');
      }

      this.rules.push(compiled);
      this.eventBus.emit('rule:added', compiled);
      return compiled;
    }

    removeRule(id) {
      this.rules = this.rules.filter(function (r) { return r.id !== id; });
      this.eventBus.emit('rule:removed', { id: id });
    }

    toggleRule(id) {
      for (var i = 0; i < this.rules.length; i++) {
        if (this.rules[i].id === id) {
          this.rules[i].enabled = !this.rules[i].enabled;
          this.eventBus.emit('rule:toggled', this.rules[i]);
          return this.rules[i];
        }
      }
      return null;
    }

    getRules() {
      return this.rules.slice();
    }

    /**
     * Apply matching rules to a request/response body.
     * Returns the modified body, or undefined if no rules matched.
     */
    applyRules(info, phase) {
      var body = (phase === 'request') ? info.body : info.responseBody;
      if (typeof body !== 'string') {
        try {
          body = JSON.stringify(body);
        } catch (e) {
          return undefined;
        }
      }

      var modified = false;
      var result = body;

      for (var i = 0; i < this.rules.length; i++) {
        var rule = this.rules[i];
        if (!rule.enabled) continue;
        if (rule.target !== phase) continue;

        // URL matching
        if (!rule.urlRegex.test(info.url)) continue;

        if (rule.action === 'block') {
          this.eventBus.emit('rule:applied', { rule: rule, info: info, action: 'block' });
          return '__WEBENG_BLOCK__';
        }

        if (rule.action === 'modify' && rule.find) {
          var findRegex;
          try {
            findRegex = new RegExp(rule.find, 'g');
          } catch (e) {
            findRegex = new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          }

          var newResult = result.replace(findRegex, rule.replace);
          if (newResult !== result) {
            result = newResult;
            modified = true;
            this.eventBus.emit('rule:applied', { rule: rule, info: info, action: 'modify' });
          }
        }
      }

      return modified ? result : undefined;
    }

    /**
     * Check if a request URL should be blocked.
     */
    shouldBlock(url) {
      for (var i = 0; i < this.rules.length; i++) {
        var rule = this.rules[i];
        if (!rule.enabled) continue;
        if (rule.action !== 'block') continue;
        if (rule.urlRegex.test(url)) return true;
      }
      return false;
    }

    /**
     * Log a request/response entry.
     */
    logRequest(info) {
      this.requestLog.push(info);
      if (this.requestLog.length > this._maxLog) {
        this.requestLog.shift();
      }
      this.eventBus.emit('request:logged', info);
    }

    /**
     * Log a WebSocket message.
     */
    logWebSocketMessage(info) {
      this.wsLog.push(info);
      if (this.wsLog.length > this._maxLog) {
        this.wsLog.shift();
      }
      this.eventBus.emit('websocket:logged', info);
    }

    /**
     * Get recent request log entries.
     */
    getRequestLog(limit) {
      limit = limit || 100;
      return this.requestLog.slice(-limit);
    }

    /**
     * Get recent WebSocket log entries.
     */
    getWebSocketLog(limit) {
      limit = limit || 100;
      return this.wsLog.slice(-limit);
    }

    /**
     * Clear all logs.
     */
    clearLogs() {
      this.requestLog = [];
      this.wsLog = [];
      this.eventBus.emit('logs:cleared');
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.HookManager = HookManager;
})();
/**
 * WebEng XHRHook — monkey-patch XMLHttpRequest for interception
 */
(function () {
  'use strict';

  var SYM_METHOD = Symbol('webeng_method');
  var SYM_URL = Symbol('webeng_url');
  var SYM_BODY = Symbol('webeng_body');

  class XHRHook {
    constructor(hookManager) {
      this.hookManager = hookManager;
      this.originalOpen = XMLHttpRequest.prototype.open;
      this.originalSend = XMLHttpRequest.prototype.send;
      this.installed = false;
    }

    install() {
      if (this.installed) return;
      var self = this;

      // Patch open to capture method and URL
      XMLHttpRequest.prototype.open = function (method, url) {
        this[SYM_METHOD] = method;
        this[SYM_URL] = String(url);
        return self.originalOpen.apply(this, arguments);
      };

      // Patch send to intercept request/response
      XMLHttpRequest.prototype.send = function (body) {
        this[SYM_BODY] = body;
        var xhr = this;
        var hookMgr = self.hookManager;

        var requestInfo = {
          type: 'xhr',
          method: xhr[SYM_METHOD] || 'GET',
          url: xhr[SYM_URL] || '',
          body: body,
          timestamp: Date.now()
        };

        // Check for block
        if (hookMgr.shouldBlock(requestInfo.url)) {
          hookMgr.logRequest(Object.assign({}, requestInfo, {
            status: 0,
            responseBody: '[BLOCKED]',
            blocked: true
          }));
          // Abort the request
          xhr.abort();
          return;
        }

        // Apply request body modification
        var modifiedBody = hookMgr.applyRules(requestInfo, 'request');
        var sendBody = (modifiedBody !== undefined && modifiedBody !== '__WEBENG_BLOCK__')
          ? modifiedBody : body;

        // Intercept the response
        xhr.addEventListener('load', function () {
          var responseInfo = {
            type: 'xhr',
            method: requestInfo.method,
            url: requestInfo.url,
            body: body,
            timestamp: requestInfo.timestamp,
            status: xhr.status,
            statusText: xhr.statusText,
            responseBody: '',
            responseTime: Date.now() - requestInfo.timestamp
          };

          // Read response
          try {
            responseInfo.responseBody = xhr.responseText;
          } catch (e) {
            responseInfo.responseBody = '[Could not read response]';
          }

          // Apply response modification rules
          var modifiedResponse = hookMgr.applyRules(responseInfo, 'response');

          if (modifiedResponse !== undefined && modifiedResponse !== '__WEBENG_BLOCK__') {
            // Override responseText and response on this instance
            try {
              Object.defineProperty(xhr, 'responseText', {
                value: modifiedResponse,
                writable: true,
                configurable: true
              });
            } catch (e) { /* best effort */ }

            try {
              Object.defineProperty(xhr, 'response', {
                value: modifiedResponse,
                writable: true,
                configurable: true
              });
            } catch (e) { /* best effort */ }

            responseInfo.modified = true;
            responseInfo.modifiedBody = modifiedResponse;
          }

          hookMgr.logRequest(responseInfo);
        });

        xhr.addEventListener('error', function () {
          hookMgr.logRequest({
            type: 'xhr',
            method: requestInfo.method,
            url: requestInfo.url,
            timestamp: requestInfo.timestamp,
            status: 0,
            responseBody: '[Network Error]',
            error: true,
            responseTime: Date.now() - requestInfo.timestamp
          });
        });

        return self.originalSend.call(xhr, sendBody);
      };

      this.installed = true;
    }

    uninstall() {
      if (!this.installed) return;
      XMLHttpRequest.prototype.open = this.originalOpen;
      XMLHttpRequest.prototype.send = this.originalSend;
      this.installed = false;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.XHRHook = XHRHook;
})();
/**
 * WebEng FetchHook — monkey-patch the global fetch() function
 */
(function () {
  'use strict';

  class FetchHook {
    constructor(hookManager) {
      this.hookManager = hookManager;
      this.originalFetch = window.fetch ? window.fetch.bind(window) : null;
      this.installed = false;
    }

    install() {
      if (this.installed || !this.originalFetch) return;
      var self = this;

      window.fetch = function (input, init) {
        init = init || {};

        // Normalize input
        var url = (typeof input === 'string') ? input :
          (input instanceof Request ? input.url : String(input));
        var method = init.method ||
          (input instanceof Request ? input.method : 'GET');

        var requestInfo = {
          type: 'fetch',
          method: method.toUpperCase(),
          url: url,
          body: init.body,
          timestamp: Date.now()
        };

        // Check for block
        if (self.hookManager.shouldBlock(url)) {
          self.hookManager.logRequest(Object.assign({}, requestInfo, {
            status: 0,
            responseBody: '[BLOCKED]',
            blocked: true
          }));
          return Promise.reject(new Error('WebEng: Request blocked by rule'));
        }

        // Apply request modification rules
        var modifiedBody = self.hookManager.applyRules(requestInfo, 'request');
        if (modifiedBody !== undefined && modifiedBody !== '__WEBENG_BLOCK__') {
          init = Object.assign({}, init, { body: modifiedBody });
        }

        // Execute the actual fetch
        return self.originalFetch(input, init).then(function (response) {
          // Clone to read body without consuming the original
          var clone = response.clone();

          return clone.text().then(function (responseBody) {
            var responseInfo = {
              type: 'fetch',
              method: requestInfo.method,
              url: requestInfo.url,
              body: requestInfo.body,
              timestamp: requestInfo.timestamp,
              status: response.status,
              statusText: response.statusText,
              responseBody: responseBody,
              responseTime: Date.now() - requestInfo.timestamp
            };

            // Apply response modification rules
            var modifiedResponse = self.hookManager.applyRules(responseInfo, 'response');

            if (modifiedResponse !== undefined && modifiedResponse !== '__WEBENG_BLOCK__') {
              responseInfo.modified = true;
              responseInfo.modifiedBody = modifiedResponse;
              self.hookManager.logRequest(responseInfo);

              // Construct new Response with modified body
              return new Response(modifiedResponse, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
              });
            }

            self.hookManager.logRequest(responseInfo);
            return response;
          }).catch(function () {
            // If we can't read the body, just log and pass through
            self.hookManager.logRequest({
              type: 'fetch',
              method: requestInfo.method,
              url: requestInfo.url,
              timestamp: requestInfo.timestamp,
              status: response.status,
              responseBody: '[Could not read body]',
              responseTime: Date.now() - requestInfo.timestamp
            });
            return response;
          });
        }).catch(function (error) {
          self.hookManager.logRequest({
            type: 'fetch',
            method: requestInfo.method,
            url: requestInfo.url,
            timestamp: requestInfo.timestamp,
            status: 0,
            responseBody: '[Fetch Error: ' + error.message + ']',
            error: true,
            responseTime: Date.now() - requestInfo.timestamp
          });
          throw error;
        });
      };

      this.installed = true;
    }

    uninstall() {
      if (!this.installed || !this.originalFetch) return;
      window.fetch = this.originalFetch;
      this.installed = false;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.FetchHook = FetchHook;
})();
/**
 * WebEng WebSocketHook — intercept WebSocket creation, send, and messages
 */
(function () {
  'use strict';

  class WebSocketHook {
    constructor(hookManager) {
      this.hookManager = hookManager;
      this.OriginalWebSocket = window.WebSocket;
      this.installed = false;
      this.activeConnections = [];
    }

    install() {
      if (this.installed) return;
      var self = this;
      var OriginalWS = this.OriginalWebSocket;

      // Create a wrapper constructor
      function WebEngWebSocket(url, protocols) {
        var ws;
        if (protocols !== undefined) {
          ws = new OriginalWS(url, protocols);
        } else {
          ws = new OriginalWS(url);
        }

        var connInfo = { url: url, ws: ws, created: Date.now() };
        self.activeConnections.push(connInfo);

        // Intercept send()
        var originalSend = ws.send.bind(ws);
        ws.send = function (data) {
          var msgInfo = {
            type: 'websocket',
            direction: 'outgoing',
            url: url,
            data: data,
            timestamp: Date.now()
          };

          self.hookManager.logWebSocketMessage(msgInfo);

          // Apply outgoing rules
          var modified = self._applyWsRules(msgInfo);
          originalSend(modified !== undefined ? modified : data);
        };

        // Intercept onmessage via property descriptor
        var userOnMessage = null;
        Object.defineProperty(ws, 'onmessage', {
          get: function () { return userOnMessage; },
          set: function (handler) {
            userOnMessage = function (event) {
              var msgInfo = {
                type: 'websocket',
                direction: 'incoming',
                url: url,
                data: event.data,
                timestamp: Date.now()
              };

              self.hookManager.logWebSocketMessage(msgInfo);

              // Apply incoming rules
              var modified = self._applyWsRules(msgInfo);

              if (modified !== undefined) {
                // Create new MessageEvent with modified data
                var modEvent = new MessageEvent('message', {
                  data: modified,
                  origin: event.origin,
                  lastEventId: event.lastEventId,
                  source: event.source,
                  ports: event.ports
                });
                handler.call(ws, modEvent);
              } else {
                handler.call(ws, event);
              }
            };
          },
          configurable: true
        });

        // Also intercept addEventListener for 'message' events
        var originalAddListener = ws.addEventListener.bind(ws);
        ws.addEventListener = function (type, listener, options) {
          if (type === 'message') {
            var wrappedListener = function (event) {
              var msgInfo = {
                type: 'websocket',
                direction: 'incoming',
                url: url,
                data: event.data,
                timestamp: Date.now()
              };
              self.hookManager.logWebSocketMessage(msgInfo);
              listener.call(ws, event);
            };
            return originalAddListener(type, wrappedListener, options);
          }
          return originalAddListener(type, listener, options);
        };

        return ws;
      }

      // Copy static properties from original WebSocket
      WebEngWebSocket.CONNECTING = OriginalWS.CONNECTING;
      WebEngWebSocket.OPEN = OriginalWS.OPEN;
      WebEngWebSocket.CLOSING = OriginalWS.CLOSING;
      WebEngWebSocket.CLOSED = OriginalWS.CLOSED;
      WebEngWebSocket.prototype = OriginalWS.prototype;

      window.WebSocket = WebEngWebSocket;
      this.installed = true;
    }

    uninstall() {
      if (!this.installed) return;
      window.WebSocket = this.OriginalWebSocket;
      this.installed = false;
    }

    _applyWsRules(msgInfo) {
      var data = msgInfo.data;
      if (typeof data !== 'string') {
        try {
          data = JSON.stringify(data);
        } catch (e) {
          return undefined;
        }
      }

      var modified = false;
      var result = data;
      var rules = this.hookManager.getRules();

      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule.enabled) continue;

        // Check URL match
        if (!rule.urlRegex.test(msgInfo.url)) continue;

        // Check direction matching (use target: 'request' for outgoing, 'response' for incoming)
        var matchDir = (msgInfo.direction === 'outgoing' && rule.target === 'request') ||
          (msgInfo.direction === 'incoming' && rule.target === 'response');
        if (!matchDir) continue;

        if (rule.action === 'modify' && rule.find) {
          var findRegex;
          try {
            findRegex = new RegExp(rule.find, 'g');
          } catch (e) {
            findRegex = new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          }

          var newResult = result.replace(findRegex, rule.replace);
          if (newResult !== result) {
            result = newResult;
            modified = true;
          }
        }
      }

      return modified ? result : undefined;
    }

    getActiveConnections() {
      return this.activeConnections.map(function (c) {
        return {
          url: c.url,
          created: c.created,
          readyState: c.ws.readyState
        };
      });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.WebSocketHook = WebSocketHook;
})();
/**
 * WebEng FreezeBypass — neuter Object.freeze/seal/preventExtensions
 */
(function () {
  'use strict';

  class FreezeBypass {
    constructor() {
      this.originalFreeze = Object.freeze;
      this.originalSeal = Object.seal;
      this.originalPreventExtensions = Object.preventExtensions;
      this.originalIsFrozen = Object.isFrozen;
      this.originalIsSealed = Object.isSealed;
      this.originalIsExtensible = Object.isExtensible;
      this.interceptedObjects = new WeakSet();
      this.enabled = false;
    }

    enable() {
      if (this.enabled) return;
      var self = this;

      // Replace Object.freeze with a no-op that tracks objects
      Object.freeze = function (obj) {
        if (obj && typeof obj === 'object') {
          self.interceptedObjects.add(obj);
        }
        return obj; // Return unfrozen
      };

      Object.seal = function (obj) {
        if (obj && typeof obj === 'object') {
          self.interceptedObjects.add(obj);
        }
        return obj;
      };

      Object.preventExtensions = function (obj) {
        if (obj && typeof obj === 'object') {
          self.interceptedObjects.add(obj);
        }
        return obj;
      };

      // Spoof checks so anti-tamper code thinks objects are still frozen
      Object.isFrozen = function (obj) {
        if (obj && typeof obj === 'object') {
          try {
            if (self.interceptedObjects.has(obj)) return true;
          } catch (e) { /* ignore */ }
        }
        return self.originalIsFrozen.call(Object, obj);
      };

      Object.isSealed = function (obj) {
        if (obj && typeof obj === 'object') {
          try {
            if (self.interceptedObjects.has(obj)) return true;
          } catch (e) { /* ignore */ }
        }
        return self.originalIsSealed.call(Object, obj);
      };

      Object.isExtensible = function (obj) {
        if (obj && typeof obj === 'object') {
          try {
            if (self.interceptedObjects.has(obj)) return false; // lie: say not extensible
          } catch (e) { /* ignore */ }
        }
        return self.originalIsExtensible.call(Object, obj);
      };

      this.enabled = true;
    }

    disable() {
      if (!this.enabled) return;
      Object.freeze = this.originalFreeze;
      Object.seal = this.originalSeal;
      Object.preventExtensions = this.originalPreventExtensions;
      Object.isFrozen = this.originalIsFrozen;
      Object.isSealed = this.originalIsSealed;
      Object.isExtensible = this.originalIsExtensible;
      this.enabled = false;
    }

    /**
     * Create a Proxy wrapper around an already-frozen object that allows writes.
     * Use this for objects that were frozen before the bypass was installed.
     */
    static createUnfreezeProxy(frozenObj) {
      var overrides = Object.create(null);
      var deletedKeys = new Set();

      return new Proxy(frozenObj, {
        get: function (target, prop) {
          if (deletedKeys.has(prop)) return undefined;
          if (prop in overrides) return overrides[prop];
          return target[prop];
        },
        set: function (target, prop, value) {
          deletedKeys.delete(prop);
          overrides[prop] = value;
          return true;
        },
        has: function (target, prop) {
          if (deletedKeys.has(prop)) return false;
          return prop in overrides || prop in target;
        },
        deleteProperty: function (target, prop) {
          delete overrides[prop];
          deletedKeys.add(prop);
          return true;
        },
        ownKeys: function (target) {
          var keys = new Set(Object.getOwnPropertyNames(target));
          Object.keys(overrides).forEach(function (k) { keys.add(k); });
          deletedKeys.forEach(function (k) { keys.delete(k); });
          return Array.from(keys);
        },
        getOwnPropertyDescriptor: function (target, prop) {
          if (deletedKeys.has(prop)) return undefined;
          if (prop in overrides) {
            return { value: overrides[prop], writable: true, enumerable: true, configurable: true };
          }
          return Object.getOwnPropertyDescriptor(target, prop);
        }
      });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.FreezeBypass = FreezeBypass;
})();
/**
 * WebEng DefinePropertyBypass — force writable/configurable on defineProperty calls
 */
(function () {
  'use strict';

  class DefinePropertyBypass {
    constructor() {
      this.originalDefineProperty = Object.defineProperty;
      this.originalDefineProperties = Object.defineProperties;
      this.enabled = false;
    }

    enable() {
      if (this.enabled) return;
      var original = this.originalDefineProperty;
      var originalMulti = this.originalDefineProperties;

      Object.defineProperty = function (obj, prop, descriptor) {
        var modified = Object.assign({}, descriptor);

        // If it's a data descriptor, force writable and configurable
        if (!('get' in modified) && !('set' in modified)) {
          if ('writable' in modified) {
            modified.writable = true;
          }
        }

        // Always force configurable so we can re-define later
        if ('configurable' in modified) {
          modified.configurable = true;
        }

        return original.call(Object, obj, prop, modified);
      };

      Object.defineProperties = function (obj, descriptors) {
        var modified = {};
        for (var key in descriptors) {
          if (descriptors.hasOwnProperty(key)) {
            var desc = Object.assign({}, descriptors[key]);
            if (!('get' in desc) && !('set' in desc)) {
              if ('writable' in desc) desc.writable = true;
            }
            if ('configurable' in desc) desc.configurable = true;
            modified[key] = desc;
          }
        }
        return originalMulti.call(Object, obj, modified);
      };

      this.enabled = true;
    }

    disable() {
      if (!this.enabled) return;
      Object.defineProperty = this.originalDefineProperty;
      Object.defineProperties = this.originalDefineProperties;
      this.enabled = false;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.DefinePropertyBypass = DefinePropertyBypass;
})();
/**
 * WebEng TimerBypass — track, block, and kill setInterval/setTimeout integrity checks
 */
(function () {
  'use strict';

  class TimerBypass {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.originalSetInterval = window.setInterval.bind(window);
      this.originalClearInterval = window.clearInterval.bind(window);
      this.originalSetTimeout = window.setTimeout.bind(window);
      this.originalClearTimeout = window.clearTimeout.bind(window);
      this.trackedIntervals = new Map();
      this.trackedTimeouts = new Map();
      this.blockedPatterns = [];
      this.enabled = false;
      this._nextId = 1;
    }

    enable() {
      if (this.enabled) return;
      var self = this;

      // Common anti-tamper patterns to auto-detect
      var suspiciousPatterns = [
        /location\s*\.\s*reload/,
        /debugger/,
        /devtool/i,
        /outerWidth\s*-\s*innerWidth/,
        /outerHeight\s*-\s*innerHeight/,
        /integrity/i,
        /tamper/i,
        /checksum/i
      ];

      window.setInterval = function (callback, interval) {
        var args = Array.prototype.slice.call(arguments, 2);
        var callbackStr = '';

        try {
          callbackStr = typeof callback === 'function' ?
            callback.toString() : String(callback);
        } catch (e) { /* ignore */ }

        // Check blocked patterns
        for (var i = 0; i < self.blockedPatterns.length; i++) {
          if (self.blockedPatterns[i].test(callbackStr)) {
            self.eventBus.emit('timer:blocked', {
              type: 'interval',
              source: callbackStr.substring(0, 200),
              interval: interval,
              pattern: self.blockedPatterns[i].toString()
            });
            return -(self._nextId++); // Return fake ID
          }
        }

        var id = self.originalSetInterval.apply(window, arguments);

        // Detect suspicious patterns
        var suspicious = false;
        for (var j = 0; j < suspiciousPatterns.length; j++) {
          if (suspiciousPatterns[j].test(callbackStr)) {
            suspicious = true;
            break;
          }
        }

        self.trackedIntervals.set(id, {
          source: callbackStr.substring(0, 300),
          interval: interval,
          created: Date.now(),
          suspicious: suspicious
        });

        self.eventBus.emit('timer:created', {
          type: 'interval',
          id: id,
          interval: interval,
          suspicious: suspicious,
          source: callbackStr.substring(0, 200)
        });

        return id;
      };

      window.setTimeout = function (callback, delay) {
        var callbackStr = '';
        try {
          callbackStr = typeof callback === 'function' ?
            callback.toString() : String(callback);
        } catch (e) { /* ignore */ }

        // Check blocked patterns
        for (var i = 0; i < self.blockedPatterns.length; i++) {
          if (self.blockedPatterns[i].test(callbackStr)) {
            return -(self._nextId++);
          }
        }

        var id = self.originalSetTimeout.apply(window, arguments);

        self.trackedTimeouts.set(id, {
          source: callbackStr.substring(0, 300),
          delay: delay,
          created: Date.now()
        });

        return id;
      };

      window.clearInterval = function (id) {
        self.trackedIntervals.delete(id);
        return self.originalClearInterval(id);
      };

      window.clearTimeout = function (id) {
        self.trackedTimeouts.delete(id);
        return self.originalClearTimeout(id);
      };

      this.enabled = true;
    }

    disable() {
      if (!this.enabled) return;
      window.setInterval = this.originalSetInterval;
      window.clearInterval = this.originalClearInterval;
      window.setTimeout = this.originalSetTimeout;
      window.clearTimeout = this.originalClearTimeout;
      this.enabled = false;
    }

    /**
     * Add a regex pattern to block matching timers.
     */
    addBlockPattern(regexStr) {
      try {
        this.blockedPatterns.push(new RegExp(regexStr));
      } catch (e) {
        this.blockedPatterns.push(new RegExp(
          regexStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        ));
      }
    }

    /**
     * Remove a block pattern by index.
     */
    removeBlockPattern(index) {
      this.blockedPatterns.splice(index, 1);
    }

    /**
     * Kill a specific interval.
     */
    killInterval(id) {
      this.originalClearInterval(id);
      this.trackedIntervals.delete(id);
      this.eventBus.emit('timer:killed', { type: 'interval', id: id });
    }

    /**
     * Kill all suspicious intervals.
     */
    killSuspicious() {
      var self = this;
      var killed = 0;
      this.trackedIntervals.forEach(function (info, id) {
        if (info.suspicious) {
          self.originalClearInterval(id);
          self.trackedIntervals.delete(id);
          killed++;
        }
      });
      this.eventBus.emit('timer:killedSuspicious', { count: killed });
      return killed;
    }

    /**
     * Get list of tracked intervals.
     */
    getIntervals() {
      var list = [];
      this.trackedIntervals.forEach(function (info, id) {
        list.push(Object.assign({ id: id }, info));
      });
      return list;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.TimerBypass = TimerBypass;
})();
/**
 * WebEng KeyboardShield — prevents game code from blocking keyboard input
 * in WebEng's input fields.
 *
 * Games (especially on CrazyGames) register capture-phase keyboard event
 * listeners on document/window that call preventDefault() and stopPropagation(),
 * preventing typing in ANY input field on the page.
 *
 * This module patches Event.prototype methods to become no-ops when:
 *   1. The event is a KeyboardEvent
 *   2. A WebEng input field currently has focus
 *
 * This allows keyboard events to flow normally to WebEng inputs while
 * preserving game keyboard handling when WebEng inputs are not focused.
 */
(function () {
  'use strict';

  class KeyboardShield {
    constructor() {
      this.enabled = false;
      this._inputFocused = false;
      this._origPreventDefault = null;
      this._origStopPropagation = null;
      this._origStopImmediate = null;
    }

    /**
     * Enable the keyboard shield by patching Event.prototype methods.
     */
    enable() {
      if (this.enabled) return;
      this.enabled = true;

      var self = this;

      // Save original methods
      this._origPreventDefault = Event.prototype.preventDefault;
      this._origStopPropagation = Event.prototype.stopPropagation;
      this._origStopImmediate = Event.prototype.stopImmediatePropagation;

      // Patch preventDefault — skip for keyboard events when WebEng input focused
      Event.prototype.preventDefault = function () {
        if (self._inputFocused && this instanceof KeyboardEvent) {
          return;
        }
        return self._origPreventDefault.call(this);
      };

      // Patch stopPropagation — same logic
      Event.prototype.stopPropagation = function () {
        if (self._inputFocused && this instanceof KeyboardEvent) {
          return;
        }
        return self._origStopPropagation.call(this);
      };

      // Patch stopImmediatePropagation — same logic
      Event.prototype.stopImmediatePropagation = function () {
        if (self._inputFocused && this instanceof KeyboardEvent) {
          return;
        }
        return self._origStopImmediate.call(this);
      };
    }

    /**
     * Disable the keyboard shield and restore original methods.
     */
    disable() {
      if (!this.enabled) return;

      if (this._origPreventDefault) {
        Event.prototype.preventDefault = this._origPreventDefault;
      }
      if (this._origStopPropagation) {
        Event.prototype.stopPropagation = this._origStopPropagation;
      }
      if (this._origStopImmediate) {
        Event.prototype.stopImmediatePropagation = this._origStopImmediate;
      }

      this._origPreventDefault = null;
      this._origStopPropagation = null;
      this._origStopImmediate = null;
      this._inputFocused = false;
      this.enabled = false;
    }

    /**
     * Called by overlay.js focus tracking when a WebEng input gains/loses focus.
     */
    setInputFocused(focused) {
      this._inputFocused = !!focused;
    }

    /**
     * Check if a WebEng input is currently focused.
     */
    isInputFocused() {
      return this._inputFocused;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.KeyboardShield = KeyboardShield;
})();
/**
 * WebEng AntiTamper — orchestrator for all bypass mechanisms
 */
(function () {
  'use strict';

  class AntiTamper {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.freezeBypass = new WebEng.FreezeBypass();
      this.definePropertyBypass = new WebEng.DefinePropertyBypass();
      this.timerBypass = new WebEng.TimerBypass(eventBus);
      this.keyboardShield = new WebEng.KeyboardShield();
      this._domObserverActive = false;
      this._originalQuerySelector = null;
    }

    /**
     * Enable all bypass mechanisms.
     */
    enableAll() {
      this.freezeBypass.enable();
      this.definePropertyBypass.enable();
      this.timerBypass.enable();
      this.keyboardShield.enable();
      this._enableDOMStealth();
    }

    /**
     * Disable all bypass mechanisms.
     */
    disableAll() {
      this.freezeBypass.disable();
      this.definePropertyBypass.disable();
      this.timerBypass.disable();
      this.keyboardShield.disable();
      this._disableDOMStealth();
    }

    /**
     * Enable/disable individual modules.
     */
    setEnabled(module, enabled) {
      var target = this._getModule(module);
      if (!target) return;

      if (enabled) {
        target.enable();
      } else {
        target.disable();
      }
    }

    isEnabled(module) {
      var target = this._getModule(module);
      return target ? target.enabled : false;
    }

    _getModule(name) {
      switch (name) {
        case 'freeze': return this.freezeBypass;
        case 'defineProperty': return this.definePropertyBypass;
        case 'timer': return this.timerBypass;
        case 'keyboard': return this.keyboardShield;
        default: return null;
      }
    }

    /**
     * Get status of all bypass modules.
     */
    getStatus() {
      return {
        freeze: this.freezeBypass.enabled,
        defineProperty: this.definePropertyBypass.enabled,
        timer: this.timerBypass.enabled,
        keyboard: this.keyboardShield.enabled,
        domStealth: this._domObserverActive
      };
    }

    /**
     * Enable DOM stealth mode — hide WebEng from document.querySelectorAll etc.
     */
    _enableDOMStealth() {
      if (this._domObserverActive) return;

      this._originalQuerySelector = document.querySelectorAll.bind(document);
      var originalQS = document.querySelector.bind(document);

      document.querySelectorAll = function () {
        var results = this._originalQuerySelector.apply(document, arguments);
        // Filter out webeng-root
        return Array.prototype.filter.call(results, function (el) {
          return el.id !== 'webeng-root';
        });
      }.bind(this);

      document.querySelector = function () {
        var result = originalQS.apply(document, arguments);
        if (result && result.id === 'webeng-root') return null;
        return result;
      };

      this._domObserverActive = true;
    }

    _disableDOMStealth() {
      if (!this._domObserverActive) return;
      if (this._originalQuerySelector) {
        document.querySelectorAll = this._originalQuerySelector;
      }
      this._domObserverActive = false;
    }

    /**
     * Create an unfreeze proxy for an already-frozen object.
     * Convenience wrapper around FreezeBypass.createUnfreezeProxy.
     */
    unfreezeObject(frozenObj) {
      return WebEng.FreezeBypass.createUnfreezeProxy(frozenObj);
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.AntiTamper = AntiTamper;
})();
/**
 * WebEng Styles — all CSS as a JS string for Shadow DOM injection
 */
(function () {
  'use strict';

  var STYLES = `
    :host {
      all: initial;
      font-family: 'Segoe UI', -apple-system, sans-serif;
      font-size: 13px;
      color: #e0e0e0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* ===== Main Container ===== */
    .webeng-panel {
      width: 480px;
      height: 560px;
      background: rgba(18, 18, 28, 0.96);
      border: 1px solid #3a3a5c;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      resize: both;
      min-width: 360px;
      min-height: 300px;
    }

    .webeng-panel.minimized {
      height: auto !important;
      min-height: auto;
      resize: none;
    }

    .webeng-panel.minimized .webeng-body {
      display: none;
    }

    /* ===== Title Bar ===== */
    .webeng-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      cursor: move;
      user-select: none;
      border-bottom: 1px solid #3a3a5c;
      flex-shrink: 0;
    }

    .webeng-title {
      font-size: 14px;
      font-weight: 600;
      color: #00d4ff;
      letter-spacing: 1px;
    }

    .webeng-title-buttons {
      display: flex;
      gap: 6px;
    }

    .webeng-title-btn {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: #aaa;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }

    .webeng-title-btn:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }

    /* ===== Tab Bar ===== */
    .webeng-tabs {
      display: flex;
      background: #0f0f1a;
      border-bottom: 1px solid #3a3a5c;
      flex-shrink: 0;
    }

    .webeng-tab {
      flex: 1;
      padding: 8px 4px;
      text-align: center;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: #888;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      user-select: none;
    }

    .webeng-tab:hover {
      color: #ccc;
      background: rgba(255, 255, 255, 0.03);
    }

    .webeng-tab.active {
      color: #00d4ff;
      border-bottom-color: #00d4ff;
    }

    /* ===== Body / Content ===== */
    .webeng-body {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .webeng-tab-content {
      display: none;
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      flex-direction: column;
    }

    .webeng-tab-content.active {
      display: flex;
    }

    /* ===== Form Controls ===== */
    .webeng-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      align-items: center;
    }

    .webeng-label {
      font-size: 11px;
      color: #888;
      margin-bottom: 4px;
      display: block;
    }

    .webeng-input {
      background: #1a1a2e;
      border: 1px solid #3a3a5c;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 6px 8px;
      font-size: 13px;
      font-family: 'Consolas', 'Monaco', monospace;
      outline: none;
      transition: border-color 0.2s;
    }

    .webeng-input:focus {
      border-color: #00d4ff;
    }

    .webeng-input::placeholder {
      color: #555;
    }

    .webeng-select {
      background: #1a1a2e;
      border: 1px solid #3a3a5c;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 6px 8px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }

    .webeng-select:focus {
      border-color: #00d4ff;
    }

    .webeng-btn {
      background: linear-gradient(135deg, #0066cc, #0044aa);
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .webeng-btn:hover {
      background: linear-gradient(135deg, #0077ee, #0055cc);
    }

    .webeng-btn:active {
      transform: scale(0.97);
    }

    .webeng-btn.danger {
      background: linear-gradient(135deg, #cc3333, #aa2222);
    }

    .webeng-btn.danger:hover {
      background: linear-gradient(135deg, #dd4444, #bb3333);
    }

    .webeng-btn.success {
      background: linear-gradient(135deg, #22aa44, #118833);
    }

    .webeng-btn.success:hover {
      background: linear-gradient(135deg, #33bb55, #229944);
    }

    .webeng-btn.secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #ccc;
    }

    .webeng-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .webeng-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .webeng-btn.small {
      padding: 3px 8px;
      font-size: 11px;
    }

    /* ===== Results Table ===== */
    .webeng-results-container {
      flex: 1;
      overflow-y: auto;
      border: 1px solid #2a2a3c;
      border-radius: 4px;
      background: #0d0d18;
    }

    .webeng-results-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .webeng-results-table th {
      background: #1a1a2e;
      padding: 6px 8px;
      text-align: left;
      font-weight: 600;
      color: #aaa;
      border-bottom: 1px solid #3a3a5c;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .webeng-results-table td {
      padding: 4px 8px;
      border-bottom: 1px solid #1a1a2e;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .webeng-results-table tr:hover td {
      background: rgba(0, 212, 255, 0.05);
    }

    .webeng-results-actions {
      display: flex;
      gap: 4px;
    }

    /* ===== Status Bar ===== */
    .webeng-status {
      padding: 4px 12px;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #2a2a3c;
      background: #0a0a14;
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
    }

    .webeng-status .count {
      color: #00d4ff;
    }

    /* ===== Network Panel ===== */
    .webeng-network-subtabs {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }

    .webeng-network-subtab {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 3px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.05);
      color: #888;
      border: none;
    }

    .webeng-network-subtab.active {
      background: rgba(0, 212, 255, 0.15);
      color: #00d4ff;
    }

    .webeng-log-entry {
      padding: 6px 8px;
      border-bottom: 1px solid #1a1a2e;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .webeng-log-entry:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .webeng-log-entry .method {
      color: #ff9800;
      font-weight: 600;
      margin-right: 8px;
    }

    .webeng-log-entry .url {
      color: #aaa;
      word-break: break-all;
    }

    .webeng-log-entry .status-ok {
      color: #4caf50;
    }

    .webeng-log-entry .status-err {
      color: #f44336;
    }

    .webeng-log-entry .ws-in {
      color: #4caf50;
    }

    .webeng-log-entry .ws-out {
      color: #ff9800;
    }

    .webeng-log-detail {
      display: none;
      padding: 8px;
      background: #0a0a14;
      border: 1px solid #2a2a3c;
      border-radius: 4px;
      margin: 4px 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
      color: #ccc;
    }

    .webeng-log-detail.expanded {
      display: block;
    }

    /* ===== Rules ===== */
    .webeng-rule {
      padding: 8px;
      border: 1px solid #2a2a3c;
      border-radius: 4px;
      margin-bottom: 6px;
      background: #0f0f1a;
    }

    .webeng-rule-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .webeng-rule-name {
      font-weight: 600;
      color: #00d4ff;
    }

    /* ===== Settings ===== */
    .webeng-setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #1a1a2e;
    }

    .webeng-setting-label {
      font-size: 13px;
    }

    .webeng-setting-desc {
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }

    /* Toggle Switch */
    .webeng-toggle {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }

    .webeng-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .webeng-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #333;
      border-radius: 22px;
      transition: 0.3s;
    }

    .webeng-toggle-slider:before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: #999;
      border-radius: 50%;
      transition: 0.3s;
    }

    .webeng-toggle input:checked + .webeng-toggle-slider {
      background: #0066cc;
    }

    .webeng-toggle input:checked + .webeng-toggle-slider:before {
      transform: translateX(18px);
      background: #fff;
    }

    /* Range slider */
    .webeng-range {
      -webkit-appearance: none;
      appearance: none;
      width: 120px;
      height: 4px;
      background: #333;
      border-radius: 2px;
      outline: none;
    }

    .webeng-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      background: #00d4ff;
      border-radius: 50%;
      cursor: pointer;
    }

    /* ===== Scrollbar ===== */
    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #555;
    }

    /* ===== Bookmarks ===== */
    .webeng-bookmarks {
      margin-top: 8px;
      border-top: 1px solid #2a2a3c;
      padding-top: 8px;
    }

    .webeng-bookmarks-title {
      font-size: 11px;
      color: #888;
      margin-bottom: 6px;
      font-weight: 600;
    }

    .webeng-bookmark-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 11px;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    .webeng-bookmark-path {
      color: #aaa;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }

    .webeng-bookmark-value {
      color: #00d4ff;
      margin: 0 8px;
    }

    /* ===== Inline Edit ===== */
    .webeng-inline-edit {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .webeng-inline-edit input {
      width: 80px;
      padding: 2px 4px;
      font-size: 11px;
      font-family: 'Consolas', 'Monaco', monospace;
      background: #1a1a2e;
      border: 1px solid #00d4ff;
      color: #e0e0e0;
      border-radius: 3px;
      outline: none;
    }

    /* ===== Empty state ===== */
    .webeng-empty {
      text-align: center;
      padding: 30px;
      color: #555;
      font-size: 13px;
    }

    /* ===== Frame Guide ===== */
    .webeng-frame-guide {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }

    .webeng-frame-guide-banner {
      background: linear-gradient(135deg, #ff6b00, #cc4400);
      color: #fff;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }

    .webeng-frame-guide-step {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #1a1a2e;
      font-size: 12px;
      color: #ccc;
      align-items: flex-start;
    }

    .webeng-frame-guide-num {
      background: #00d4ff;
      color: #000;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      flex-shrink: 0;
    }

    .webeng-frame-guide-url {
      background: #0d0d18;
      border: 1px solid #3a3a5c;
      border-radius: 4px;
      padding: 8px 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      color: #00d4ff;
      word-break: break-all;
    }

    .webeng-frame-guide-tip {
      font-size: 11px;
      color: #888;
      font-style: italic;
      margin-top: 4px;
    }

    /* ===== Iframe Mode Badge ===== */
    .webeng-iframe-badge {
      background: #22aa44;
      color: #fff;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      margin-left: 8px;
    }

    /* ===== Animations ===== */
    @keyframes webeng-fadein {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .webeng-panel {
      animation: webeng-fadein 0.2s ease-out;
    }
  `;

  window.WebEng = window.WebEng || {};
  window.WebEng.STYLES = STYLES;
})();
/**
 * WebEng Overlay — Shadow DOM container with drag, minimize, hotkey toggle
 */
(function () {
  'use strict';

  class Overlay {
    constructor() {
      this.host = null;
      this.shadow = null;
      this.panel = null;
      this.visible = true;
      this.minimized = false;
      this._dragState = null;
      this._onKeyDown = this._onKeyDown.bind(this);
    }

    /**
     * Create and attach the overlay to the page.
     * Returns the shadow root for other UI modules to render into.
     */
    create() {
      // Create host element
      this.host = document.createElement('div');
      this.host.id = 'webeng-root';
      this.host.style.cssText =
        'all:initial;position:fixed;z-index:2147483647;top:10px;right:10px;' +
        'font-family:sans-serif;font-size:13px;';

      document.body.appendChild(this.host);

      // Create closed shadow DOM with delegatesFocus for better input handling
      this.shadow = this.host.attachShadow({ mode: 'closed', delegatesFocus: true });

      // Inject styles
      var style = document.createElement('style');
      style.textContent = WebEng.STYLES;
      this.shadow.appendChild(style);

      // Create main panel
      this.panel = document.createElement('div');
      this.panel.className = 'webeng-panel';
      this.shadow.appendChild(this.panel);

      // Title bar
      this._createTitleBar();

      // Body container (tabs + content are added by dashboard)
      this.body = document.createElement('div');
      this.body.className = 'webeng-body';
      this.panel.appendChild(this.body);

      // Status bar
      this.statusBar = document.createElement('div');
      this.statusBar.className = 'webeng-status';
      this.statusBar.innerHTML =
        '<span>WebEng v1.0</span>' +
        '<span class="count" id="webeng-status-text">Ready</span>';
      this.panel.appendChild(this.statusBar);

      // Setup drag
      this._setupDrag();

      // Setup keyboard shortcut
      document.addEventListener('keydown', this._onKeyDown, true);

      // Setup focus tracking for keyboard shield
      this._setupFocusTracking();

      return this.shadow;
    }

    _createTitleBar() {
      var titlebar = document.createElement('div');
      titlebar.className = 'webeng-titlebar';

      var title = document.createElement('span');
      title.className = 'webeng-title';
      title.textContent = 'WEBENG';

      var buttons = document.createElement('div');
      buttons.className = 'webeng-title-buttons';

      // Minimize button
      var minBtn = document.createElement('button');
      minBtn.className = 'webeng-title-btn';
      minBtn.innerHTML = '&#8211;';
      minBtn.title = 'Minimize';
      var self = this;
      minBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self.toggleMinimize();
      });

      // Close/hide button
      var closeBtn = document.createElement('button');
      closeBtn.className = 'webeng-title-btn';
      closeBtn.innerHTML = '&#10005;';
      closeBtn.title = 'Hide (Ctrl+Shift+G to show)';
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self.hide();
      });

      buttons.appendChild(minBtn);
      buttons.appendChild(closeBtn);
      titlebar.appendChild(title);
      titlebar.appendChild(buttons);
      this.panel.appendChild(titlebar);
      this.titlebar = titlebar;
    }

    _setupDrag() {
      var self = this;
      var titlebar = this.titlebar;

      titlebar.addEventListener('pointerdown', function (e) {
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        self._dragState = {
          startX: e.clientX,
          startY: e.clientY,
          startLeft: self.host.offsetLeft,
          startTop: self.host.offsetTop
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });

      function onMove(e) {
        if (!self._dragState) return;
        var dx = e.clientX - self._dragState.startX;
        var dy = e.clientY - self._dragState.startY;
        self.host.style.left = (self._dragState.startLeft + dx) + 'px';
        self.host.style.top = (self._dragState.startTop + dy) + 'px';
        self.host.style.right = 'auto';
      }

      function onUp() {
        self._dragState = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
    }

    /**
     * Track focus on input elements inside shadow DOM.
     * Notifies the KeyboardShield when a WebEng input gains/loses focus,
     * so it can suppress game keyboard event interception.
     */
    _setupFocusTracking() {
      this.shadow.addEventListener('focusin', function (e) {
        var tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          if (window.__WEBENG__ && window.__WEBENG__.antiTamper &&
              window.__WEBENG__.antiTamper.keyboardShield) {
            window.__WEBENG__.antiTamper.keyboardShield.setInputFocused(true);
          }
        }
      });

      this.shadow.addEventListener('focusout', function () {
        if (window.__WEBENG__ && window.__WEBENG__.antiTamper &&
            window.__WEBENG__.antiTamper.keyboardShield) {
          window.__WEBENG__.antiTamper.keyboardShield.setInputFocused(false);
        }
      });
    }

    _onKeyDown(e) {
      // Ctrl+Shift+G to toggle visibility
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      }
    }

    toggle() {
      if (this.visible) {
        this.hide();
      } else {
        this.show();
      }
    }

    show() {
      this.host.style.display = 'block';
      this.visible = true;
    }

    hide() {
      this.host.style.display = 'none';
      this.visible = false;
    }

    toggleMinimize() {
      this.minimized = !this.minimized;
      if (this.minimized) {
        this.panel.classList.add('minimized');
      } else {
        this.panel.classList.remove('minimized');
      }
    }

    setStatus(text) {
      var el = this.shadow.querySelector('#webeng-status-text');
      if (el) el.textContent = text;
    }

    getBody() {
      return this.body;
    }

    getShadow() {
      return this.shadow;
    }

    /**
     * Enable iframe mode — adds visual badge and adapts sizing for small viewports.
     */
    setIframeMode(enabled) {
      if (!enabled) return;
      // Add "IFRAME" badge next to title
      var title = this.titlebar.querySelector('.webeng-title');
      if (title) {
        var badge = document.createElement('span');
        badge.className = 'webeng-iframe-badge';
        badge.textContent = 'IFRAME';
        title.appendChild(badge);
      }

      // Adaptive sizing for small iframe viewports
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      if (vw < 600 || vh < 500) {
        this.panel.style.width = Math.min(380, vw - 20) + 'px';
        this.panel.style.height = Math.min(420, vh - 20) + 'px';
      }
    }

    destroy() {
      document.removeEventListener('keydown', this._onKeyDown, true);
      if (this.host && this.host.parentNode) {
        this.host.parentNode.removeChild(this.host);
      }
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Overlay = Overlay;
})();
/**
 * WebEng ScannerPanel — UI for first scan / next scan workflow
 * Includes iframe, WASM, tolerance, and engine detection controls.
 */
(function () {
  'use strict';

  class ScannerPanel {
    constructor(scanner, eventBus) {
      this.scanner = scanner;
      this.eventBus = eventBus;
      this.element = null;
    }

    render() {
      this.element = document.createElement('div');
      this.element.className = 'webeng-tab-content';
      this.element.id = 'webeng-scanner-panel';

      // Search value row
      var row1 = document.createElement('div');
      row1.className = 'webeng-row';

      this.valueInput = document.createElement('input');
      this.valueInput.type = 'text';
      this.valueInput.className = 'webeng-input';
      this.valueInput.placeholder = 'Search value...';
      this.valueInput.style.flex = '1';

      this.typeSelect = document.createElement('select');
      this.typeSelect.className = 'webeng-select';
      var types = [
        { value: 'any', label: 'Any Type' },
        { value: 'number', label: 'Number' },
        { value: 'string', label: 'String' },
        { value: 'boolean', label: 'Boolean' }
      ];
      for (var i = 0; i < types.length; i++) {
        var opt = document.createElement('option');
        opt.value = types[i].value;
        opt.textContent = types[i].label;
        this.typeSelect.appendChild(opt);
      }

      row1.appendChild(this.valueInput);
      row1.appendChild(this.typeSelect);

      // Comparator + buttons row
      var row2 = document.createElement('div');
      row2.className = 'webeng-row';

      this.comparatorSelect = document.createElement('select');
      this.comparatorSelect.className = 'webeng-select';
      var comparators = [
        { value: 'exact', label: 'Exact (=)' },
        { value: 'greater', label: 'Greater (>)' },
        { value: 'less', label: 'Less (<)' },
        { value: 'not_equal', label: 'Not Equal' },
        { value: 'changed', label: 'Changed' },
        { value: 'unchanged', label: 'Unchanged' },
        { value: 'increased', label: 'Increased' },
        { value: 'decreased', label: 'Decreased' }
      ];
      for (var j = 0; j < comparators.length; j++) {
        var copt = document.createElement('option');
        copt.value = comparators[j].value;
        copt.textContent = comparators[j].label;
        this.comparatorSelect.appendChild(copt);
      }

      this.firstScanBtn = document.createElement('button');
      this.firstScanBtn.className = 'webeng-btn';
      this.firstScanBtn.textContent = 'First Scan';

      this.nextScanBtn = document.createElement('button');
      this.nextScanBtn.className = 'webeng-btn secondary';
      this.nextScanBtn.textContent = 'Next Scan';
      this.nextScanBtn.disabled = true;

      this.resetBtn = document.createElement('button');
      this.resetBtn.className = 'webeng-btn danger small';
      this.resetBtn.textContent = 'Reset';

      row2.appendChild(this.comparatorSelect);
      row2.appendChild(this.firstScanBtn);
      row2.appendChild(this.nextScanBtn);
      row2.appendChild(this.resetBtn);

      // Scan scope row (iframe + WASM + tolerance)
      var row3 = document.createElement('div');
      row3.className = 'webeng-row';
      row3.style.cssText = 'flex-wrap:wrap;gap:6px;';

      // Iframe checkbox
      this.iframeCheckbox = document.createElement('input');
      this.iframeCheckbox.type = 'checkbox';
      this.iframeCheckbox.checked = true;
      this.iframeCheckbox.id = 'webeng-scan-iframes';
      this.iframeCheckbox.style.margin = '0';
      var iframeLabel = document.createElement('label');
      iframeLabel.htmlFor = 'webeng-scan-iframes';
      iframeLabel.textContent = 'Iframes';
      iframeLabel.style.cssText = 'font-size:11px;color:#aaa;cursor:pointer;margin-right:8px;';

      // WASM checkbox
      this.wasmCheckbox = document.createElement('input');
      this.wasmCheckbox.type = 'checkbox';
      this.wasmCheckbox.checked = true;
      this.wasmCheckbox.id = 'webeng-scan-wasm';
      this.wasmCheckbox.style.margin = '0';
      var wasmLabel = document.createElement('label');
      wasmLabel.htmlFor = 'webeng-scan-wasm';
      wasmLabel.textContent = 'WASM';
      wasmLabel.style.cssText = 'font-size:11px;color:#aaa;cursor:pointer;margin-right:4px;';

      // WASM type select
      this.wasmTypeSelect = document.createElement('select');
      this.wasmTypeSelect.className = 'webeng-select';
      this.wasmTypeSelect.style.cssText = 'font-size:11px;padding:2px 4px;margin-right:8px;';
      var wasmTypes = [
        { value: 'auto', label: 'Auto' },
        { value: 'i32', label: 'Int32' },
        { value: 'f32', label: 'Float32' },
        { value: 'f64', label: 'Float64' }
      ];
      for (var wt = 0; wt < wasmTypes.length; wt++) {
        var wopt = document.createElement('option');
        wopt.value = wasmTypes[wt].value;
        wopt.textContent = wasmTypes[wt].label;
        this.wasmTypeSelect.appendChild(wopt);
      }

      // Tolerance
      var tolLabel = document.createElement('span');
      tolLabel.textContent = 'Tol:';
      tolLabel.style.cssText = 'font-size:11px;color:#aaa;';
      this.toleranceInput = document.createElement('input');
      this.toleranceInput.type = 'text';
      this.toleranceInput.className = 'webeng-input';
      this.toleranceInput.value = '0';
      this.toleranceInput.title = 'Float tolerance (0 = exact match)';
      this.toleranceInput.style.cssText = 'width:45px;font-size:11px;padding:2px 4px;';

      // Detect engine button
      this.detectBtn = document.createElement('button');
      this.detectBtn.className = 'webeng-btn small secondary';
      this.detectBtn.textContent = 'Detect';
      this.detectBtn.title = 'Auto-detect game engine';

      // Store reference for iframe mode adjustment
      this._iframeLabel = iframeLabel;

      row3.appendChild(this.iframeCheckbox);
      row3.appendChild(iframeLabel);
      row3.appendChild(this.wasmCheckbox);
      row3.appendChild(wasmLabel);
      row3.appendChild(this.wasmTypeSelect);
      row3.appendChild(tolLabel);
      row3.appendChild(this.toleranceInput);
      row3.appendChild(this.detectBtn);

      // Scan info
      this.scanInfo = document.createElement('div');
      this.scanInfo.style.cssText = 'font-size:11px;color:#666;margin-bottom:8px;';
      this.scanInfo.textContent = 'Enter a value and click First Scan to begin.';

      this.element.appendChild(row1);
      this.element.appendChild(row2);
      this.element.appendChild(row3);
      this.element.appendChild(this.scanInfo);

      // Iframe mode adjustments (applied after __WEBENG__ is registered)
      var self0 = this;
      setTimeout(function () {
        if (window.__WEBENG__ && window.__WEBENG__.isIframeMode) {
          self0.iframeCheckbox.checked = false;
          self0._iframeLabel.textContent = 'Sub-iframes';
          self0._iframeLabel.title = 'Scan iframes within this frame (usually not needed)';
        }
      }, 100);

      this._bindEvents();

      return this.element;
    }

    _bindEvents() {
      var self = this;

      this.firstScanBtn.addEventListener('click', function () {
        var value = self.valueInput.value;
        var type = self.typeSelect.value;
        var comparator = self.comparatorSelect.value;

        if (!value && comparator === 'exact') {
          self.scanInfo.textContent = 'Please enter a value to scan for.';
          return;
        }

        // Apply settings to scanner
        self.scanner.scanIframes = self.iframeCheckbox.checked;
        self.scanner.scanWasm = self.wasmCheckbox.checked;
        self.scanner.wasmScanType = self.wasmTypeSelect.value;
        self.scanner.tolerance = parseFloat(self.toleranceInput.value) || 0;

        self._setScanning(true);
        self.scanner.firstScan(value, type, comparator).then(function () {
          self._setScanning(false);
          self.nextScanBtn.disabled = false;
          self.firstScanBtn.disabled = true;
        }).catch(function (err) {
          self._setScanning(false);
          self.scanInfo.textContent = 'Scan error: ' + err.message;
        });
      });

      this.nextScanBtn.addEventListener('click', function () {
        var value = self.valueInput.value;
        var comparator = self.comparatorSelect.value;

        self._setScanning(true);
        self.scanner.nextScan(value, comparator).then(function () {
          self._setScanning(false);
        }).catch(function (err) {
          self._setScanning(false);
          self.scanInfo.textContent = 'Scan error: ' + err.message;
        });
      });

      this.resetBtn.addEventListener('click', function () {
        self.scanner.reset();
        self.firstScanBtn.disabled = false;
        self.nextScanBtn.disabled = true;
        self.scanInfo.textContent = 'Scan reset. Enter a value and click First Scan.';
      });

      // Detect engine button
      this.detectBtn.addEventListener('click', function () {
        if (!WebEng.EngineDetector) {
          self.scanInfo.textContent = 'Engine detector not available.';
          return;
        }

        var isIframeMode = window.__WEBENG__ && window.__WEBENG__.isIframeMode;
        var engines;

        if (isIframeMode) {
          // In iframe mode, detect directly on current window
          engines = WebEng.EngineDetector.detect(window);
          for (var ei = 0; ei < engines.length; ei++) {
            engines[ei].context = 'current frame';
          }
        } else {
          var iframeSc = window.__WEBENG__ && window.__WEBENG__.iframeScanner;
          if (iframeSc) {
            try { iframeSc.detectIframes(); } catch (e) { /* ignore */ }
          }
          engines = WebEng.EngineDetector.detectAll(iframeSc);
        }

        if (engines.length === 0) {
          // Also report iframe info
          var iframeInfo = iframeSc ? iframeSc.getIframeInfo() : [];
          var iframeMsg = iframeInfo.length > 0 ?
            ' Found ' + iframeInfo.length + ' iframe(s), ' +
            iframeInfo.filter(function (f) { return f.accessible; }).length + ' accessible.' :
            ' No iframes found.';
          self.scanInfo.textContent = 'No recognized game engine detected.' + iframeMsg;
        } else {
          var lines = engines.map(function (e) {
            return e.name + ' (' + e.context + ')' + (e.hasWasm ? ' [WASM]' : '');
          });
          self.scanInfo.textContent = 'Detected: ' + lines.join(', ');

          // Auto-enable WASM if detected
          if (engines.some(function (e) { return e.hasWasm; })) {
            self.wasmCheckbox.checked = true;
          }
        }

        // Also check for WASM modules
        var wasmSc = window.__WEBENG__ && window.__WEBENG__.wasmScanner;
        if (wasmSc) {
          try {
            var iframeSc2 = isIframeMode ? null : (window.__WEBENG__ && window.__WEBENG__.iframeScanner);
            wasmSc.detectModules(iframeSc2);
            if (wasmSc._modules.length > 0) {
              self.scanInfo.textContent += ' | WASM: ' + wasmSc._modules.length +
                ' module(s), ' + (wasmSc._modules[0].heapBuffer.byteLength / 1048576).toFixed(1) + 'MB heap';
            }
          } catch (e) { /* ignore */ }
        }
      });

      // Enter key triggers scan
      this.valueInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          if (!self.firstScanBtn.disabled) {
            self.firstScanBtn.click();
          } else if (!self.nextScanBtn.disabled) {
            self.nextScanBtn.click();
          }
        }
      });

      // Listen for scan events
      this.eventBus.on('scan:start', function (data) {
        self.scanInfo.textContent = 'Scanning... (scan #' + data.scanNumber + ')';
      });

      this.eventBus.on('scan:complete', function (data) {
        self.scanInfo.textContent =
          'Scan #' + data.scanNumber + ' complete: ' +
          data.resultCount + ' result' + (data.resultCount !== 1 ? 's' : '') + ' found.';
      });

      this.eventBus.on('scan:reset', function () {
        self.scanInfo.textContent = 'Scan reset. Enter a value and click First Scan.';
      });
    }

    _setScanning(isScanning) {
      this.firstScanBtn.disabled = isScanning;
      this.nextScanBtn.disabled = isScanning;
      this.valueInput.disabled = isScanning;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.ScannerPanel = ScannerPanel;
})();
/**
 * WebEng ResultsPanel — scan results table with modify, freeze, bookmark
 */
(function () {
  'use strict';

  class ResultsPanel {
    constructor(modifier, pathResolver, eventBus) {
      this.modifier = modifier;
      this.pathResolver = pathResolver;
      this.eventBus = eventBus;
      this.element = null;
      this.resultsContainer = null;
      this.bookmarksContainer = null;
      this.currentResults = [];
    }

    render() {
      this.element = document.createElement('div');
      this.element.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;';

      // Results table container
      this.resultsContainer = document.createElement('div');
      this.resultsContainer.className = 'webeng-results-container';
      this.resultsContainer.style.flex = '1';
      this.resultsContainer.innerHTML =
        '<div class="webeng-empty">No scan results yet.<br>Use the Scanner tab to find values.</div>';

      // Bookmarks section
      this.bookmarksContainer = document.createElement('div');
      this.bookmarksContainer.className = 'webeng-bookmarks';
      this.bookmarksContainer.style.display = 'none';

      this.element.appendChild(this.resultsContainer);
      this.element.appendChild(this.bookmarksContainer);

      this._bindEvents();

      return this.element;
    }

    _bindEvents() {
      var self = this;

      this.eventBus.on('scan:complete', function (data) {
        self.currentResults = data.results || [];
        self._renderResults(data.results, data.resultCount);
      });

      this.eventBus.on('scan:reset', function () {
        self.currentResults = [];
        self.resultsContainer.innerHTML =
          '<div class="webeng-empty">No scan results yet.<br>Use the Scanner tab to find values.</div>';
      });

      this.eventBus.on('bookmark:added', function () {
        self._renderBookmarks();
      });

      this.eventBus.on('bookmark:removed', function () {
        self._renderBookmarks();
      });
    }

    _renderResults(results, totalCount) {
      if (!results || results.length === 0) {
        this.resultsContainer.innerHTML =
          '<div class="webeng-empty">No matching values found.</div>';
        return;
      }

      var html = '<table class="webeng-results-table">' +
        '<thead><tr>' +
        '<th>Path</th>' +
        '<th>Value</th>' +
        '<th>Type</th>' +
        '<th>Actions</th>' +
        '</tr></thead><tbody>';

      var displayResults = results.slice(0, 500);

      for (var i = 0; i < displayResults.length; i++) {
        var r = displayResults[i];
        var shortPath = r.path.length > 40 ?
          '...' + r.path.substring(r.path.length - 37) : r.path;
        var displayVal = this._escapeHtml(String(r.value));
        if (displayVal.length > 30) {
          displayVal = displayVal.substring(0, 27) + '...';
        }

        var frozenClass = this.modifier.isFrozen(r.path) ? ' style="color:#ff9800"' : '';

        html += '<tr data-index="' + i + '">' +
          '<td title="' + this._escapeHtml(r.path) + '">' + this._escapeHtml(shortPath) + '</td>' +
          '<td' + frozenClass + '>' + displayVal + '</td>' +
          '<td>' + r.type + '</td>' +
          '<td class="webeng-results-actions">' +
          '<button class="webeng-btn small" data-action="edit" data-index="' + i + '">Edit</button>' +
          '<button class="webeng-btn small ' +
          (this.modifier.isFrozen(r.path) ? 'danger' : 'secondary') +
          '" data-action="freeze" data-index="' + i + '">' +
          (this.modifier.isFrozen(r.path) ? 'Unfreeze' : 'Freeze') + '</button>' +
          '<button class="webeng-btn small secondary" data-action="bookmark" data-index="' + i + '">+BM</button>' +
          '</td></tr>';
      }

      html += '</tbody></table>';

      if (totalCount > 500) {
        html += '<div style="padding:8px;font-size:11px;color:#666;text-align:center;">' +
          'Showing 500 of ' + totalCount + ' results. Narrow your search.</div>';
      }

      this.resultsContainer.innerHTML = html;

      // Bind action buttons
      var self = this;
      this.resultsContainer.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var index = parseInt(btn.getAttribute('data-index'));
        var result = self.currentResults[index];
        if (!result) return;

        if (action === 'edit') {
          self._showEditInline(btn, result, index);
        } else if (action === 'freeze') {
          self._toggleFreeze(result, btn);
        } else if (action === 'bookmark') {
          self.modifier.addBookmark(result.path);
        }
      });
    }

    _showEditInline(btn, result, index) {
      var td = btn.closest('td');
      var row = btn.closest('tr');
      var valueCell = row.querySelectorAll('td')[1];

      // Replace value cell with inline editor
      var container = document.createElement('div');
      container.className = 'webeng-inline-edit';

      var input = document.createElement('input');
      input.type = 'text';
      input.value = String(result.value);

      var okBtn = document.createElement('button');
      okBtn.className = 'webeng-btn small success';
      okBtn.textContent = 'OK';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'webeng-btn small secondary';
      cancelBtn.textContent = 'X';

      container.appendChild(input);
      container.appendChild(okBtn);
      container.appendChild(cancelBtn);

      var originalContent = valueCell.innerHTML;
      valueCell.innerHTML = '';
      valueCell.appendChild(container);
      input.focus();
      input.select();

      var self = this;

      function apply() {
        var success = self.modifier.setValue(result.path, input.value);
        if (success) {
          // Read back the actual value
          try {
            var newVal = self.pathResolver.resolveValue(result.path);
            result.value = newVal;
            valueCell.textContent = String(newVal);
          } catch (e) {
            valueCell.textContent = input.value;
          }
        } else {
          valueCell.innerHTML = originalContent;
        }
      }

      function cancel() {
        valueCell.innerHTML = originalContent;
      }

      okBtn.addEventListener('click', apply);
      cancelBtn.addEventListener('click', cancel);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') apply();
        if (e.key === 'Escape') cancel();
      });
    }

    _toggleFreeze(result, btn) {
      if (this.modifier.isFrozen(result.path)) {
        this.modifier.unfreeze(result.path);
        btn.textContent = 'Freeze';
        btn.className = 'webeng-btn small secondary';
      } else {
        this.modifier.freeze(result.path, result.value);
        btn.textContent = 'Unfreeze';
        btn.className = 'webeng-btn small danger';
      }
    }

    _renderBookmarks() {
      var bookmarks = this.modifier.getBookmarks();

      if (bookmarks.length === 0) {
        this.bookmarksContainer.style.display = 'none';
        return;
      }

      this.bookmarksContainer.style.display = 'block';
      var html = '<div class="webeng-bookmarks-title">Bookmarks</div>';

      for (var i = 0; i < bookmarks.length; i++) {
        var b = bookmarks[i];
        html += '<div class="webeng-bookmark-item">' +
          '<span class="webeng-bookmark-path" title="' + this._escapeHtml(b.path) + '">' +
          this._escapeHtml(b.label) + '</span>' +
          '<span class="webeng-bookmark-value">' + this._escapeHtml(String(b.value)) + '</span>' +
          '<div>' +
          '<button class="webeng-btn small" data-bm-edit="' + i + '">Edit</button> ' +
          '<button class="webeng-btn small danger" data-bm-remove="' + this._escapeHtml(b.path) + '">X</button>' +
          '</div></div>';
      }

      this.bookmarksContainer.innerHTML = html;

      // Bind bookmark actions
      var self = this;
      this.bookmarksContainer.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('[data-bm-remove]');
        if (removeBtn) {
          self.modifier.removeBookmark(removeBtn.getAttribute('data-bm-remove'));
        }
      });
    }

    _escapeHtml(str) {
      return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.ResultsPanel = ResultsPanel;
})();
/**
 * WebEng NetworkPanel — XHR/Fetch/WebSocket log and rule editor
 */
(function () {
  'use strict';

  class NetworkPanel {
    constructor(hookManager, eventBus) {
      this.hookManager = hookManager;
      this.eventBus = eventBus;
      this.element = null;
      this.activeSubTab = 'requests';
      this.logContainer = null;
      this.wsLogContainer = null;
      this.rulesContainer = null;
    }

    render() {
      this.element = document.createElement('div');
      this.element.className = 'webeng-tab-content';

      // Sub-tabs
      var subtabs = document.createElement('div');
      subtabs.className = 'webeng-network-subtabs';

      var tabs = [
        { id: 'requests', label: 'XHR / Fetch' },
        { id: 'websocket', label: 'WebSocket' },
        { id: 'rules', label: 'Rules' }
      ];

      var self = this;
      this._subtabBtns = [];
      this._subPanels = [];

      for (var i = 0; i < tabs.length; i++) {
        (function (tab, index) {
          var btn = document.createElement('button');
          btn.className = 'webeng-network-subtab' + (index === 0 ? ' active' : '');
          btn.textContent = tab.label;
          btn.addEventListener('click', function () {
            self._switchSubTab(index);
          });
          subtabs.appendChild(btn);
          self._subtabBtns.push(btn);
        })(tabs[i], i);
      }

      this.element.appendChild(subtabs);

      // Request log panel
      this.logContainer = document.createElement('div');
      this.logContainer.className = 'webeng-results-container';
      this.logContainer.style.flex = '1';
      this.logContainer.innerHTML = '<div class="webeng-empty">No requests captured yet.</div>';

      // WebSocket log panel
      this.wsLogContainer = document.createElement('div');
      this.wsLogContainer.className = 'webeng-results-container';
      this.wsLogContainer.style.cssText = 'flex:1;display:none;';
      this.wsLogContainer.innerHTML = '<div class="webeng-empty">No WebSocket messages captured yet.</div>';

      // Rules panel
      this.rulesContainer = document.createElement('div');
      this.rulesContainer.style.cssText = 'flex:1;display:none;overflow-y:auto;';
      this._renderRulesPanel();

      this.element.appendChild(this.logContainer);
      this.element.appendChild(this.wsLogContainer);
      this.element.appendChild(this.rulesContainer);
      this._subPanels = [this.logContainer, this.wsLogContainer, this.rulesContainer];

      // Clear button
      var clearRow = document.createElement('div');
      clearRow.className = 'webeng-row';
      clearRow.style.marginTop = '8px';
      var clearBtn = document.createElement('button');
      clearBtn.className = 'webeng-btn small danger';
      clearBtn.textContent = 'Clear Logs';
      clearBtn.addEventListener('click', function () {
        self.hookManager.clearLogs();
        self.logContainer.innerHTML = '<div class="webeng-empty">Logs cleared.</div>';
        self.wsLogContainer.innerHTML = '<div class="webeng-empty">Logs cleared.</div>';
      });
      clearRow.appendChild(clearBtn);
      this.element.appendChild(clearRow);

      this._bindEvents();

      return this.element;
    }

    _switchSubTab(index) {
      for (var i = 0; i < this._subtabBtns.length; i++) {
        this._subtabBtns[i].classList.remove('active');
        this._subPanels[i].style.display = 'none';
      }
      this._subtabBtns[index].classList.add('active');
      this._subPanels[index].style.display = 'block';
      this._subPanels[index].style.flex = '1';
    }

    _bindEvents() {
      var self = this;

      this.eventBus.on('request:logged', function (info) {
        self._appendLogEntry(info);
      });

      this.eventBus.on('websocket:logged', function (info) {
        self._appendWsEntry(info);
      });
    }

    _appendLogEntry(info) {
      // Remove empty placeholder
      var empty = this.logContainer.querySelector('.webeng-empty');
      if (empty) empty.remove();

      var entry = document.createElement('div');
      entry.className = 'webeng-log-entry';

      var statusClass = (info.status >= 200 && info.status < 300) ? 'status-ok' :
        (info.status === 0 || info.status >= 400) ? 'status-err' : '';
      var blockedTag = info.blocked ? ' <span style="color:#f44336">[BLOCKED]</span>' : '';
      var modifiedTag = info.modified ? ' <span style="color:#ff9800">[MODIFIED]</span>' : '';

      entry.innerHTML =
        '<span class="method">' + this._esc(info.method) + '</span>' +
        '<span class="' + statusClass + '">' + (info.status || '---') + '</span> ' +
        '<span class="url">' + this._esc(this._truncate(info.url, 60)) + '</span>' +
        blockedTag + modifiedTag;

      // Detail section (toggle on click)
      var detail = document.createElement('div');
      detail.className = 'webeng-log-detail';

      var bodyPreview = info.responseBody || '';
      if (bodyPreview.length > 2000) {
        bodyPreview = bodyPreview.substring(0, 2000) + '\n...[truncated]';
      }

      detail.textContent =
        'URL: ' + info.url + '\n' +
        'Method: ' + info.method + '\n' +
        'Status: ' + info.status + ' ' + (info.statusText || '') + '\n' +
        'Time: ' + (info.responseTime || 0) + 'ms\n' +
        '--- Response Body ---\n' + bodyPreview;

      if (info.modifiedBody) {
        var modPreview = info.modifiedBody.length > 1000 ?
          info.modifiedBody.substring(0, 1000) + '\n...[truncated]' : info.modifiedBody;
        detail.textContent += '\n--- Modified Body ---\n' + modPreview;
      }

      entry.addEventListener('click', function () {
        detail.classList.toggle('expanded');
      });

      entry.appendChild(detail);
      this.logContainer.appendChild(entry);

      // Auto-scroll to bottom
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    _appendWsEntry(info) {
      var empty = this.wsLogContainer.querySelector('.webeng-empty');
      if (empty) empty.remove();

      var entry = document.createElement('div');
      entry.className = 'webeng-log-entry';

      var dirClass = info.direction === 'incoming' ? 'ws-in' : 'ws-out';
      var dirLabel = info.direction === 'incoming' ? 'IN' : 'OUT';
      var dataPreview = typeof info.data === 'string' ?
        this._truncate(info.data, 80) : '[Binary]';

      entry.innerHTML =
        '<span class="' + dirClass + '">[' + dirLabel + ']</span> ' +
        '<span class="url">' + this._esc(dataPreview) + '</span>';

      var detail = document.createElement('div');
      detail.className = 'webeng-log-detail';
      var fullData = typeof info.data === 'string' ? info.data : '[Binary Data]';
      if (fullData.length > 2000) {
        fullData = fullData.substring(0, 2000) + '\n...[truncated]';
      }
      detail.textContent = 'URL: ' + info.url + '\nDirection: ' + info.direction +
        '\n--- Data ---\n' + fullData;

      entry.addEventListener('click', function () {
        detail.classList.toggle('expanded');
      });

      entry.appendChild(detail);
      this.wsLogContainer.appendChild(entry);
      this.wsLogContainer.scrollTop = this.wsLogContainer.scrollHeight;
    }

    _renderRulesPanel() {
      var self = this;
      this.rulesContainer.innerHTML = '';

      // "Add Rule" button
      var addRow = document.createElement('div');
      addRow.className = 'webeng-row';
      var addBtn = document.createElement('button');
      addBtn.className = 'webeng-btn success';
      addBtn.textContent = '+ New Rule';
      addBtn.addEventListener('click', function () {
        self._showRuleEditor();
      });
      addRow.appendChild(addBtn);
      this.rulesContainer.appendChild(addRow);

      // Existing rules
      this.rulesList = document.createElement('div');
      this._refreshRulesList();
      this.rulesContainer.appendChild(this.rulesList);
    }

    _refreshRulesList() {
      if (!this.rulesList) return;
      this.rulesList.innerHTML = '';

      var rules = this.hookManager.getRules();
      var self = this;

      if (rules.length === 0) {
        this.rulesList.innerHTML = '<div class="webeng-empty">No rules defined.</div>';
        return;
      }

      for (var i = 0; i < rules.length; i++) {
        (function (rule) {
          var div = document.createElement('div');
          div.className = 'webeng-rule';

          var header = document.createElement('div');
          header.className = 'webeng-rule-header';

          var nameSpan = document.createElement('span');
          nameSpan.className = 'webeng-rule-name';
          nameSpan.textContent = rule.name;
          nameSpan.style.opacity = rule.enabled ? '1' : '0.5';

          var actions = document.createElement('div');
          actions.style.display = 'flex';
          actions.style.gap = '4px';

          var toggleBtn = document.createElement('button');
          toggleBtn.className = 'webeng-btn small ' + (rule.enabled ? 'secondary' : 'success');
          toggleBtn.textContent = rule.enabled ? 'Disable' : 'Enable';
          toggleBtn.addEventListener('click', function () {
            self.hookManager.toggleRule(rule.id);
            self._refreshRulesList();
          });

          var removeBtn = document.createElement('button');
          removeBtn.className = 'webeng-btn small danger';
          removeBtn.textContent = 'Delete';
          removeBtn.addEventListener('click', function () {
            self.hookManager.removeRule(rule.id);
            self._refreshRulesList();
          });

          actions.appendChild(toggleBtn);
          actions.appendChild(removeBtn);
          header.appendChild(nameSpan);
          header.appendChild(actions);

          var details = document.createElement('div');
          details.style.cssText = 'font-size:11px;color:#888;margin-top:4px;font-family:monospace;';
          details.textContent =
            rule.action.toUpperCase() + ' ' + rule.target + ' | URL: ' +
            rule.urlPattern + (rule.find ? ' | Find: ' + rule.find + ' → ' + rule.replace : '');

          div.appendChild(header);
          div.appendChild(details);
          self.rulesList.appendChild(div);
        })(rules[i]);
      }
    }

    _showRuleEditor() {
      var self = this;

      var overlay = document.createElement('div');
      overlay.style.cssText =
        'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);' +
        'display:flex;align-items:center;justify-content:center;z-index:10;';

      var form = document.createElement('div');
      form.style.cssText =
        'background:#1a1a2e;border:1px solid #3a3a5c;border-radius:8px;' +
        'padding:16px;width:90%;max-width:400px;';

      form.innerHTML =
        '<div style="font-size:14px;font-weight:600;color:#00d4ff;margin-bottom:12px;">New Rule</div>' +
        '<label class="webeng-label">Name</label>' +
        '<input class="webeng-input" id="webeng-rule-name" style="width:100%;margin-bottom:8px;" placeholder="My Rule">' +
        '<label class="webeng-label">URL Pattern (regex)</label>' +
        '<input class="webeng-input" id="webeng-rule-url" style="width:100%;margin-bottom:8px;" placeholder=".*api.*/endpoint.*">' +
        '<div class="webeng-row">' +
        '<div style="flex:1"><label class="webeng-label">Target</label>' +
        '<select class="webeng-select" id="webeng-rule-target" style="width:100%">' +
        '<option value="response">Response</option><option value="request">Request</option></select></div>' +
        '<div style="flex:1"><label class="webeng-label">Action</label>' +
        '<select class="webeng-select" id="webeng-rule-action" style="width:100%">' +
        '<option value="modify">Modify</option><option value="block">Block</option></select></div></div>' +
        '<label class="webeng-label">Find (regex pattern)</label>' +
        '<input class="webeng-input" id="webeng-rule-find" style="width:100%;margin-bottom:8px;" placeholder=\'"gold":100\'>' +
        '<label class="webeng-label">Replace with</label>' +
        '<input class="webeng-input" id="webeng-rule-replace" style="width:100%;margin-bottom:12px;" placeholder=\'"gold":999999\'>' +
        '<div class="webeng-row" style="justify-content:flex-end">' +
        '<button class="webeng-btn secondary" id="webeng-rule-cancel">Cancel</button>' +
        '<button class="webeng-btn success" id="webeng-rule-save">Save Rule</button></div>';

      overlay.appendChild(form);

      // Find the panel's shadow root container
      var panel = this.element.closest('.webeng-panel') || this.element.parentElement;
      panel.style.position = 'relative';
      panel.appendChild(overlay);

      // Bind buttons using event delegation on the form
      form.querySelector('#webeng-rule-cancel').addEventListener('click', function () {
        overlay.remove();
      });

      form.querySelector('#webeng-rule-save').addEventListener('click', function () {
        var name = form.querySelector('#webeng-rule-name').value || 'Rule';
        var urlPattern = form.querySelector('#webeng-rule-url').value || '.*';
        var target = form.querySelector('#webeng-rule-target').value;
        var action = form.querySelector('#webeng-rule-action').value;
        var find = form.querySelector('#webeng-rule-find').value;
        var replace = form.querySelector('#webeng-rule-replace').value;

        self.hookManager.addRule({
          name: name,
          urlPattern: urlPattern,
          target: target,
          action: action,
          find: find,
          replace: replace
        });

        self._refreshRulesList();
        overlay.remove();
      });
    }

    _esc(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _truncate(str, len) {
      if (str.length <= len) return str;
      return str.substring(0, len - 3) + '...';
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.NetworkPanel = NetworkPanel;
})();
/**
 * WebEng SettingsPanel — bypass toggles, scan config, export/import
 */
(function () {
  'use strict';

  class SettingsPanel {
    constructor(antiTamper, objectWalker, eventBus) {
      this.antiTamper = antiTamper;
      this.objectWalker = objectWalker;
      this.eventBus = eventBus;
      this.element = null;
    }

    render() {
      this.element = document.createElement('div');
      this.element.className = 'webeng-tab-content';

      // Title
      var title = document.createElement('div');
      title.style.cssText = 'font-size:14px;font-weight:600;color:#00d4ff;margin-bottom:12px;';
      title.textContent = 'Bypass & Settings';
      this.element.appendChild(title);

      // Bypass toggles
      this._addToggle('Object.freeze Bypass', 'Prevent games from making objects read-only', 'freeze');
      this._addToggle('DefineProperty Bypass', 'Force writable/configurable on all property definitions', 'defineProperty');
      this._addToggle('Timer Tracker', 'Track and block integrity-check timers', 'timer');

      // Divider
      var divider = document.createElement('div');
      divider.style.cssText = 'border-top:1px solid #2a2a3c;margin:12px 0;';
      this.element.appendChild(divider);

      // Scan depth setting
      var depthRow = document.createElement('div');
      depthRow.className = 'webeng-setting-row';

      var depthInfo = document.createElement('div');
      depthInfo.innerHTML =
        '<div class="webeng-setting-label">Scan Depth</div>' +
        '<div class="webeng-setting-desc">How deep to recurse into objects (higher = slower)</div>';

      var depthControl = document.createElement('div');
      depthControl.style.display = 'flex';
      depthControl.style.alignItems = 'center';
      depthControl.style.gap = '8px';

      var depthSlider = document.createElement('input');
      depthSlider.type = 'range';
      depthSlider.className = 'webeng-range';
      depthSlider.min = '2';
      depthSlider.max = '15';
      depthSlider.value = String(this.objectWalker.maxDepth);

      var depthLabel = document.createElement('span');
      depthLabel.style.cssText = 'color:#00d4ff;font-weight:600;min-width:20px;text-align:center;';
      depthLabel.textContent = String(this.objectWalker.maxDepth);

      var self = this;
      depthSlider.addEventListener('input', function () {
        self.objectWalker.maxDepth = parseInt(depthSlider.value);
        depthLabel.textContent = depthSlider.value;
      });

      depthControl.appendChild(depthSlider);
      depthControl.appendChild(depthLabel);
      depthRow.appendChild(depthInfo);
      depthRow.appendChild(depthControl);
      this.element.appendChild(depthRow);

      // Divider
      var divider2 = document.createElement('div');
      divider2.style.cssText = 'border-top:1px solid #2a2a3c;margin:12px 0;';
      this.element.appendChild(divider2);

      // Timer management section
      var timerTitle = document.createElement('div');
      timerTitle.style.cssText = 'font-size:13px;font-weight:600;color:#e0e0e0;margin-bottom:8px;';
      timerTitle.textContent = 'Active Timers';
      this.element.appendChild(timerTitle);

      this.timerList = document.createElement('div');
      this.timerList.style.cssText = 'max-height:150px;overflow-y:auto;margin-bottom:8px;';
      this.element.appendChild(this.timerList);

      var timerBtnRow = document.createElement('div');
      timerBtnRow.className = 'webeng-row';

      var refreshTimersBtn = document.createElement('button');
      refreshTimersBtn.className = 'webeng-btn small secondary';
      refreshTimersBtn.textContent = 'Refresh Timers';
      refreshTimersBtn.addEventListener('click', function () {
        self._refreshTimers();
      });

      var killSuspiciousBtn = document.createElement('button');
      killSuspiciousBtn.className = 'webeng-btn small danger';
      killSuspiciousBtn.textContent = 'Kill Suspicious';
      killSuspiciousBtn.addEventListener('click', function () {
        var count = self.antiTamper.timerBypass.killSuspicious();
        self._refreshTimers();
        self.eventBus.emit('status:update', 'Killed ' + count + ' suspicious timer(s)');
      });

      timerBtnRow.appendChild(refreshTimersBtn);
      timerBtnRow.appendChild(killSuspiciousBtn);
      this.element.appendChild(timerBtnRow);

      // Divider
      var divider3 = document.createElement('div');
      divider3.style.cssText = 'border-top:1px solid #2a2a3c;margin:12px 0;';
      this.element.appendChild(divider3);

      // Export/Import section
      var eiTitle = document.createElement('div');
      eiTitle.style.cssText = 'font-size:13px;font-weight:600;color:#e0e0e0;margin-bottom:8px;';
      eiTitle.textContent = 'Configuration';
      this.element.appendChild(eiTitle);

      var eiBtnRow = document.createElement('div');
      eiBtnRow.className = 'webeng-row';

      var exportBtn = document.createElement('button');
      exportBtn.className = 'webeng-btn small';
      exportBtn.textContent = 'Export Config';
      exportBtn.addEventListener('click', function () {
        self._exportConfig();
      });

      var importBtn = document.createElement('button');
      importBtn.className = 'webeng-btn small secondary';
      importBtn.textContent = 'Import Config';
      importBtn.addEventListener('click', function () {
        self._importConfig();
      });

      eiBtnRow.appendChild(exportBtn);
      eiBtnRow.appendChild(importBtn);
      this.element.appendChild(eiBtnRow);

      // Enable all / disable all
      var divider4 = document.createElement('div');
      divider4.style.cssText = 'border-top:1px solid #2a2a3c;margin:12px 0;';
      this.element.appendChild(divider4);

      var allBtnRow = document.createElement('div');
      allBtnRow.className = 'webeng-row';

      var enableAllBtn = document.createElement('button');
      enableAllBtn.className = 'webeng-btn success';
      enableAllBtn.textContent = 'Enable All Bypasses';
      enableAllBtn.addEventListener('click', function () {
        self.antiTamper.enableAll();
        self._refreshToggles();
        self.eventBus.emit('status:update', 'All bypasses enabled');
      });

      var disableAllBtn = document.createElement('button');
      disableAllBtn.className = 'webeng-btn danger';
      disableAllBtn.textContent = 'Disable All';
      disableAllBtn.addEventListener('click', function () {
        self.antiTamper.disableAll();
        self._refreshToggles();
        self.eventBus.emit('status:update', 'All bypasses disabled');
      });

      allBtnRow.appendChild(enableAllBtn);
      allBtnRow.appendChild(disableAllBtn);
      this.element.appendChild(allBtnRow);

      return this.element;
    }

    _addToggle(label, desc, module) {
      var row = document.createElement('div');
      row.className = 'webeng-setting-row';

      var info = document.createElement('div');
      info.innerHTML =
        '<div class="webeng-setting-label">' + label + '</div>' +
        '<div class="webeng-setting-desc">' + desc + '</div>';

      var toggle = document.createElement('label');
      toggle.className = 'webeng-toggle';

      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.antiTamper.isEnabled(module);
      checkbox.dataset.module = module;

      var slider = document.createElement('span');
      slider.className = 'webeng-toggle-slider';

      var self = this;
      checkbox.addEventListener('change', function () {
        self.antiTamper.setEnabled(module, checkbox.checked);
        self.eventBus.emit('status:update',
          label + ' ' + (checkbox.checked ? 'enabled' : 'disabled'));
      });

      toggle.appendChild(checkbox);
      toggle.appendChild(slider);

      row.appendChild(info);
      row.appendChild(toggle);
      this.element.appendChild(row);
    }

    _refreshToggles() {
      var checkboxes = this.element.querySelectorAll('input[type="checkbox"][data-module]');
      var self = this;
      checkboxes.forEach(function (cb) {
        cb.checked = self.antiTamper.isEnabled(cb.dataset.module);
      });
    }

    _refreshTimers() {
      if (!this.antiTamper.timerBypass.enabled) {
        this.timerList.innerHTML =
          '<div style="font-size:11px;color:#666;">Enable Timer Tracker to see active timers.</div>';
        return;
      }

      var intervals = this.antiTamper.timerBypass.getIntervals();
      if (intervals.length === 0) {
        this.timerList.innerHTML =
          '<div style="font-size:11px;color:#666;">No tracked intervals.</div>';
        return;
      }

      var html = '';
      var self = this;

      for (var i = 0; i < intervals.length; i++) {
        var timer = intervals[i];
        var color = timer.suspicious ? '#f44336' : '#888';
        var tag = timer.suspicious ? ' [SUSPICIOUS]' : '';

        html += '<div style="padding:4px 0;border-bottom:1px solid #1a1a2e;font-size:11px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="color:' + color + ';">ID ' + timer.id +
          ' (' + timer.interval + 'ms)' + tag + '</span>' +
          '<button class="webeng-btn small danger" data-kill-timer="' + timer.id + '">Kill</button>' +
          '</div>' +
          '<div style="color:#555;font-family:monospace;font-size:10px;' +
          'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:380px;">' +
          this._esc(timer.source.substring(0, 150)) + '</div></div>';
      }

      this.timerList.innerHTML = html;

      // Bind kill buttons
      this.timerList.querySelectorAll('[data-kill-timer]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = parseInt(btn.getAttribute('data-kill-timer'));
          self.antiTamper.timerBypass.killInterval(id);
          self._refreshTimers();
        });
      });
    }

    _exportConfig() {
      var config = {
        version: 1,
        bypass: this.antiTamper.getStatus(),
        scanDepth: this.objectWalker.maxDepth,
        rules: window.WebEng._hookManager ? window.WebEng._hookManager.getRules().map(function (r) {
          return {
            name: r.name,
            urlPattern: r.urlPattern,
            target: r.target,
            action: r.action,
            find: r.find,
            replace: r.replace,
            enabled: r.enabled
          };
        }) : []
      };

      var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'webeng-config.json';
      a.click();
      URL.revokeObjectURL(url);
    }

    _importConfig() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      var self = this;

      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function (e) {
          try {
            var config = JSON.parse(e.target.result);

            // Apply bypass settings
            if (config.bypass) {
              for (var key in config.bypass) {
                if (key !== 'domStealth') {
                  self.antiTamper.setEnabled(key, config.bypass[key]);
                }
              }
              self._refreshToggles();
            }

            // Apply scan depth
            if (config.scanDepth) {
              self.objectWalker.maxDepth = config.scanDepth;
            }

            // Apply rules
            if (config.rules && window.WebEng._hookManager) {
              config.rules.forEach(function (r) {
                window.WebEng._hookManager.addRule(r);
              });
            }

            self.eventBus.emit('status:update', 'Config imported');
          } catch (err) {
            self.eventBus.emit('status:update', 'Import failed: ' + err.message);
          }
        };
        reader.readAsText(file);
      });

      input.click();
    }

    _esc(str) {
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.SettingsPanel = SettingsPanel;
})();
/**
 * WebEng FrameGuide — step-by-step UI guiding users to inject WebEng
 * into cross-origin game iframes via DevTools frame context switching.
 */
(function () {
  'use strict';

  var PORTAL_TIPS = {
    'CrazyGames': 'CrazyGames loads games from games.crazygames.com — look for that domain in the frame dropdown.',
    'Poki': 'Poki loads games from various subdomains — look for the game URL (not poki.com) in the frame dropdown.',
    'Newgrounds': 'Newgrounds games may load from uploads.ungrounded.net or the game developer\'s domain.',
    'itch.io': 'itch.io games load from html-classic.itch.zone or html.itch.zone subdomains.',
    'Kongregate': 'Kongregate games load from various external domains.',
    'Armor Games': 'Armor Games loads games from files.armorgames.com or external domains.',
    'Game Distribution': 'Games load from html5.gamedistribution.com subdomains.',
    'Y8': 'Y8 games load from various game server domains.'
  };

  class FrameGuide {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.element = null;
      this._crossOriginIframes = [];
      this._portalInfo = null;
    }

    render() {
      this.element = document.createElement('div');
      this.element.className = 'webeng-tab-content webeng-frame-guide';
      this.element.style.display = 'none';

      // Banner
      this._banner = document.createElement('div');
      this._banner.className = 'webeng-frame-guide-banner';
      this._banner.textContent = 'Game is inside a cross-origin iframe';
      this.element.appendChild(this._banner);

      // Explanation
      var explain = document.createElement('div');
      explain.style.cssText = 'font-size:11px;color:#aaa;line-height:1.5;';
      explain.textContent =
        'The game runs in a separate domain inside an iframe. ' +
        'Due to browser security, WebEng cannot access game values from this page. ' +
        'Follow the steps below to inject WebEng directly into the game frame.';
      this.element.appendChild(explain);

      // Detected iframe info
      this._iframeInfoEl = document.createElement('div');
      this._iframeInfoEl.className = 'webeng-frame-guide-url';
      this._iframeInfoEl.textContent = '(detecting...)';
      this.element.appendChild(this._iframeInfoEl);

      // Steps container
      this._stepsEl = document.createElement('div');
      this._stepsEl.style.cssText = 'display:flex;flex-direction:column;';
      this.element.appendChild(this._stepsEl);

      this._renderSteps();

      // Portal tip
      this._tipEl = document.createElement('div');
      this._tipEl.className = 'webeng-frame-guide-tip';
      this._tipEl.style.display = 'none';
      this.element.appendChild(this._tipEl);

      // Dismiss button
      var dismissRow = document.createElement('div');
      dismissRow.style.cssText = 'display:flex;gap:8px;margin-top:4px;';

      var dismissBtn = document.createElement('button');
      dismissBtn.className = 'webeng-btn small secondary';
      dismissBtn.textContent = 'Dismiss';
      var self = this;
      dismissBtn.addEventListener('click', function () {
        self.hide();
        self.eventBus.emit('frameguide:dismissed');
      });
      dismissRow.appendChild(dismissBtn);

      this.element.appendChild(dismissRow);

      return this.element;
    }

    _renderSteps() {
      var steps = [
        'In the DevTools Console, look at the dropdown at the top-left of the console area. It usually shows "top" or the page URL.',
        'Click the dropdown and find the game frame — it will show the game\'s URL (see above).',
        'Select that frame. The console context will switch to the game iframe.',
        'Paste the WebEng script into the console again and press Enter. WebEng will load inside the game with full access to its values.'
      ];

      for (var i = 0; i < steps.length; i++) {
        var step = document.createElement('div');
        step.className = 'webeng-frame-guide-step';

        var num = document.createElement('div');
        num.className = 'webeng-frame-guide-num';
        num.textContent = String(i + 1);

        var text = document.createElement('div');
        text.style.cssText = 'flex:1;line-height:1.4;';
        text.textContent = steps[i];

        step.appendChild(num);
        step.appendChild(text);
        this._stepsEl.appendChild(step);
      }
    }

    /**
     * Show the guide with detected cross-origin iframe info.
     * @param {Array} crossOriginIframes - from ContextDetector.getCrossOriginIframes()
     * @param {Object|null} portalInfo - from ContextDetector.detectPortal()
     */
    show(crossOriginIframes, portalInfo) {
      this._crossOriginIframes = crossOriginIframes || [];
      this._portalInfo = portalInfo;

      // Update iframe info display
      if (this._crossOriginIframes.length > 0) {
        var primary = this._crossOriginIframes[0]; // Largest by area
        var desc = WebEng.ContextDetector.describeIframeUrl(primary.src);
        this._iframeInfoEl.innerHTML = '';

        var label = document.createElement('span');
        label.style.cssText = 'color:#aaa;font-size:10px;';
        label.textContent = 'Game frame URL (look for this in the dropdown):';
        this._iframeInfoEl.appendChild(label);

        var urlEl = document.createElement('div');
        urlEl.style.cssText = 'color:#00d4ff;margin-top:4px;word-break:break-all;';
        urlEl.textContent = primary.src;
        this._iframeInfoEl.appendChild(urlEl);

        if (primary.width > 0 && primary.height > 0) {
          var sizeEl = document.createElement('span');
          sizeEl.style.cssText = 'color:#666;font-size:10px;margin-top:2px;display:block;';
          sizeEl.textContent = primary.width + 'x' + primary.height + ' px — largest iframe (likely the game)';
          this._iframeInfoEl.appendChild(sizeEl);
        }

        if (this._crossOriginIframes.length > 1) {
          var otherEl = document.createElement('div');
          otherEl.style.cssText = 'color:#666;font-size:10px;margin-top:6px;border-top:1px solid #2a2a3c;padding-top:4px;';
          otherEl.textContent = (this._crossOriginIframes.length - 1) +
            ' other cross-origin iframe(s) also detected.';
          this._iframeInfoEl.appendChild(otherEl);
        }
      } else {
        this._iframeInfoEl.textContent = 'No cross-origin iframes detected.';
      }

      // Show portal-specific tip
      if (portalInfo && PORTAL_TIPS[portalInfo.name]) {
        this._tipEl.textContent = 'Tip: ' + PORTAL_TIPS[portalInfo.name];
        this._tipEl.style.display = 'block';
      } else {
        this._tipEl.style.display = 'none';
      }

      this.element.style.display = 'flex';
    }

    hide() {
      if (this.element) {
        this.element.style.display = 'none';
      }
    }

    isVisible() {
      return this.element && this.element.style.display !== 'none';
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.FrameGuide = FrameGuide;
})();
/**
 * WebEng Dashboard — tab-based navigation wiring all panels together
 */
(function () {
  'use strict';

  class Dashboard {
    constructor(options) {
      this.overlay = options.overlay;
      this.eventBus = options.eventBus;
      this.scannerPanel = options.scannerPanel;
      this.resultsPanel = options.resultsPanel;
      this.networkPanel = options.networkPanel;
      this.settingsPanel = options.settingsPanel;
      this.frameGuide = options.frameGuide || null;
      this.tabs = [];
      this.activeTab = 0;
      this.frameGuideEl = null;
      this._contentContainer = null;
    }

    render() {
      var body = this.overlay.getBody();

      // Create tab bar
      var tabBar = document.createElement('div');
      tabBar.className = 'webeng-tabs';

      var tabDefs = [
        { label: 'Scanner', id: 'scanner' },
        { label: 'Results', id: 'results' },
        { label: 'Network', id: 'network' },
        { label: 'Settings', id: 'settings' }
      ];

      var self = this;
      var contentContainer = document.createElement('div');
      contentContainer.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';

      for (var i = 0; i < tabDefs.length; i++) {
        (function (index, def) {
          var tab = document.createElement('div');
          tab.className = 'webeng-tab' + (index === 0 ? ' active' : '');
          tab.textContent = def.label;
          tab.addEventListener('click', function () {
            self._switchTab(index);
          });
          tabBar.appendChild(tab);
          self.tabs.push(tab);
        })(i, tabDefs[i]);
      }

      body.appendChild(tabBar);

      // Render panels
      var scannerEl = this.scannerPanel.render();
      scannerEl.classList.add('active');

      var resultsEl = this.resultsPanel.render();
      var resultsWrapper = document.createElement('div');
      resultsWrapper.className = 'webeng-tab-content';
      resultsWrapper.appendChild(resultsEl);

      var networkEl = this.networkPanel.render();
      var settingsEl = this.settingsPanel.render();

      this.panels = [scannerEl, resultsWrapper, networkEl, settingsEl];

      for (var j = 0; j < this.panels.length; j++) {
        contentContainer.appendChild(this.panels[j]);
      }

      // Frame guide (hidden initially, shown when cross-origin iframes detected)
      if (this.frameGuide) {
        this.frameGuideEl = this.frameGuide.render();
        this.frameGuideEl.style.display = 'none';
        contentContainer.appendChild(this.frameGuideEl);

        var self2 = this;
        this.eventBus.on('iframe:cross-origin-detected', function (data) {
          self2._showFrameGuide(data);
        });

        this.eventBus.on('frameguide:dismissed', function () {
          self2._hideFrameGuide();
        });
      }

      this._contentContainer = contentContainer;
      body.appendChild(contentContainer);
    }

    _switchTab(index) {
      // Deactivate all
      for (var i = 0; i < this.tabs.length; i++) {
        this.tabs[i].classList.remove('active');
        this.panels[i].classList.remove('active');
      }
      // Hide frame guide when switching tabs
      if (this.frameGuideEl) {
        this.frameGuideEl.style.display = 'none';
      }
      // Activate selected
      this.tabs[index].classList.add('active');
      this.panels[index].classList.add('active');
      this.activeTab = index;
    }

    /**
     * Show the frame guide overlay and hide regular panels.
     */
    _showFrameGuide(data) {
      if (!this.frameGuideEl || !this.frameGuide) return;

      // Hide all regular panels
      for (var i = 0; i < this.panels.length; i++) {
        this.panels[i].classList.remove('active');
      }

      // Show frame guide with detected data
      var portal = WebEng.ContextDetector ? WebEng.ContextDetector.detectPortal() : null;
      this.frameGuide.show(data.iframes, portal);
    }

    /**
     * Hide the frame guide and restore the previous active tab.
     */
    _hideFrameGuide() {
      if (this.frameGuideEl) {
        this.frameGuideEl.style.display = 'none';
      }
      // Re-activate the current tab
      if (this.tabs[this.activeTab]) {
        this.tabs[this.activeTab].classList.add('active');
        this.panels[this.activeTab].classList.add('active');
      }
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Dashboard = Dashboard;
})();
/**
 * WebEng — Main Entry Point
 * Browser game value modifier engine.
 * Bootstraps all modules and attaches the UI to the page.
 */
(function () {
  'use strict';

  // ===== Idempotency Guard =====
  if (window.__WEBENG__) {
    // Already loaded — toggle visibility
    if (window.__WEBENG__.overlay) {
      window.__WEBENG__.overlay.toggle();
    }
    console.log('[WebEng] Already loaded. Toggled visibility.');
    return;
  }

  console.log('[WebEng] Initializing...');

  // ===== 1. Context Detection =====
  var context = WebEng.ContextDetector.detectContext();
  var isIframeMode = WebEng.ContextDetector.isIframe();
  var portal = isIframeMode ? null : WebEng.ContextDetector.detectPortal();
  var isGameFrame = WebEng.ContextDetector.looksLikeGameFrame();

  console.log('[WebEng] Context: ' + context +
    (portal ? ' (Portal: ' + portal.name + ')' : '') +
    (isIframeMode ? ' [IFRAME MODE]' : '') +
    (isGameFrame ? ' [Game detected]' : ''));

  // ===== 2. Event Bus =====
  var eventBus = new WebEng.EventBus();

  // ===== 3. Logger =====
  var logger = new WebEng.Logger('info');

  // ===== 4. Bypass Mechanisms (must install early) =====
  var antiTamper = new WebEng.AntiTamper(eventBus);
  antiTamper.enableAll();
  logger.info('Anti-tamper bypasses enabled.');

  // ===== 5. Core Engine =====
  var objectWalker = new WebEng.ObjectWalker({ maxDepth: 10 });
  var pathResolver = WebEng.PathResolver;
  var iframeScanner = new WebEng.IframeScanner(eventBus);
  var wasmScanner = new WebEng.WasmScanner(eventBus);

  var scanner = new WebEng.Scanner(objectWalker, pathResolver, eventBus, {
    iframeScanner: iframeScanner,
    wasmScanner: wasmScanner
  });

  // In iframe mode, disable iframe sub-scanning by default
  if (isIframeMode) {
    scanner.scanIframes = false;
  }

  var modifier = new WebEng.Modifier(pathResolver, eventBus);

  // ===== 6. Network Hooks =====
  var hookManager = new WebEng.HookManager(eventBus);
  var xhrHook = new WebEng.XHRHook(hookManager);
  var fetchHook = new WebEng.FetchHook(hookManager);
  var wsHook = new WebEng.WebSocketHook(hookManager);

  xhrHook.install();
  fetchHook.install();
  wsHook.install();
  logger.info('Network hooks installed.');

  // ===== 7. UI =====
  var overlay = new WebEng.Overlay();
  overlay.create();

  // Set iframe mode on overlay (badge + adaptive sizing)
  if (isIframeMode) {
    overlay.setIframeMode(true);
  }

  var scannerPanel = new WebEng.ScannerPanel(scanner, eventBus);
  var resultsPanel = new WebEng.ResultsPanel(modifier, pathResolver, eventBus);
  var networkPanel = new WebEng.NetworkPanel(hookManager, eventBus);
  var settingsPanel = new WebEng.SettingsPanel(antiTamper, objectWalker, eventBus);

  // Create frame guide only when NOT in iframe mode (parent page needs it)
  var frameGuide = null;
  if (!isIframeMode && WebEng.FrameGuide) {
    frameGuide = new WebEng.FrameGuide(eventBus);
  }

  var dashboard = new WebEng.Dashboard({
    overlay: overlay,
    eventBus: eventBus,
    scannerPanel: scannerPanel,
    resultsPanel: resultsPanel,
    networkPanel: networkPanel,
    settingsPanel: settingsPanel,
    frameGuide: frameGuide
  });

  dashboard.render();

  // ===== 8. Status Updates =====
  var _lastMeaningfulStatus = 'Ready';

  eventBus.on('scan:complete', function (data) {
    _lastMeaningfulStatus = data.resultCount + ' result(s) — scan #' + data.scanNumber;
    overlay.setStatus(_lastMeaningfulStatus);
  });

  eventBus.on('scan:reset', function () {
    _lastMeaningfulStatus = 'Ready';
    overlay.setStatus(_lastMeaningfulStatus);
  });

  eventBus.on('value:modified', function (data) {
    _lastMeaningfulStatus = 'Modified: ' + data.path.split('.').pop();
    overlay.setStatus(_lastMeaningfulStatus);
  });

  eventBus.on('value:frozen', function (data) {
    _lastMeaningfulStatus = 'Frozen: ' + data.path.split('.').pop();
    overlay.setStatus(_lastMeaningfulStatus);
  });

  // Debounced network request status — don't flood the status bar
  var _requestCount = 0;
  var _requestDebounce = null;
  eventBus.on('request:logged', function () {
    _requestCount++;
    if (!_requestDebounce) {
      _requestDebounce = setTimeout(function () {
        // Only show if no more important status is pending
        if (_requestCount > 0) {
          overlay.setStatus(_requestCount + ' request(s) intercepted');
          _requestCount = 0;
          // Revert to meaningful status after a brief display
          setTimeout(function () {
            overlay.setStatus(_lastMeaningfulStatus);
          }, 2000);
        }
        _requestDebounce = null;
      }, 3000);
    }
  });

  eventBus.on('status:update', function (text) {
    _lastMeaningfulStatus = text;
    overlay.setStatus(text);
  });

  // Bridge status updates
  eventBus.on('bridge:connected', function (data) {
    overlay.setStatus('Bridge connected (' + data.peerRole + ')');
    logger.info('PostMessage bridge connected to', data.peerRole);
  });

  eventBus.on('bridge:status', function (data) {
    overlay.setStatus('[Bridge] ' + data.text);
  });

  // ===== 9. Register Global Reference =====
  window.__WEBENG__ = {
    overlay: overlay,
    eventBus: eventBus,
    scanner: scanner,
    modifier: modifier,
    hookManager: hookManager,
    antiTamper: antiTamper,
    objectWalker: objectWalker,
    pathResolver: pathResolver,
    iframeScanner: iframeScanner,
    wasmScanner: wasmScanner,
    logger: logger,
    context: context,
    isIframeMode: isIframeMode,
    bridge: null,

    // Convenience API for console usage
    scan: function (value, type, comparator) {
      return scanner.firstScan(value, type || 'any', comparator || 'exact');
    },
    nextScan: function (value, comparator) {
      return scanner.nextScan(value, comparator || 'exact');
    },
    set: function (path, value) {
      return modifier.setValue(path, value);
    },
    freeze: function (path, value) {
      modifier.freeze(path, value);
    },
    unfreeze: function (path) {
      modifier.unfreeze(path);
    },
    addRule: function (rule) {
      return hookManager.addRule(rule);
    },
    unfreezeObj: function (obj) {
      return antiTamper.unfreezeObject(obj);
    },
    wasmScan: function (value, type) {
      wasmScanner.detectModules(isIframeMode ? null : iframeScanner);
      return wasmScanner.firstScan(Number(value), type || 'i32', 0.01, 0);
    },
    detectEngine: function () {
      if (isIframeMode) {
        return WebEng.EngineDetector.detect(window);
      }
      iframeScanner.detectIframes();
      return WebEng.EngineDetector.detectAll(iframeScanner);
    }
  };

  WebEng._hookManager = hookManager;

  // ===== 10. Auto-detect on load (delayed to let game initialize) =====
  setTimeout(function () {
    try {
      if (isIframeMode) {
        // IFRAME MODE: detect engines + WASM on current window only
        var statusParts = ['IFRAME MODE'];

        var engines = WebEng.EngineDetector.detect(window);
        wasmScanner.detectModules(null); // no iframe scanner needed

        if (isGameFrame) {
          statusParts.push('Game frame detected');
        }

        if (engines.length > 0) {
          var engineNames = engines.map(function (e) { return e.name; });
          statusParts.push('Engine: ' + engineNames.join(', '));
          logger.info('Detected engines:', engineNames.join(', '));
        }

        if (wasmScanner._modules.length > 0) {
          var heapMB = (wasmScanner._modules[0].heapBuffer.byteLength / 1048576).toFixed(1);
          statusParts.push('WASM: ' + wasmScanner._modules.length + ' module(s), ' + heapMB + 'MB');
          logger.info('WASM modules:', wasmScanner._modules.length);
        }

        eventBus.emit('status:update', statusParts.join(' | '));

        // Set up bridge in iframe mode
        if (WebEng.PostMessageBridge) {
          var bridge = new WebEng.PostMessageBridge(eventBus, 'iframe');
          bridge.start();
          window.__WEBENG__.bridge = bridge;
          logger.info('PostMessage bridge started (iframe role)');
        }
      } else {
        // PARENT/TOP MODE: run full detection
        iframeScanner.detectIframes();
        var iframeInfo = iframeScanner.getIframeInfo();

        var engines2 = WebEng.EngineDetector.detectAll(iframeScanner);
        wasmScanner.detectModules(iframeScanner);

        var statusParts2 = [];

        if (iframeInfo.length > 0) {
          var accessible = iframeInfo.filter(function (f) { return f.accessible; }).length;
          statusParts2.push(iframeInfo.length + ' iframe(s), ' + accessible + ' accessible');
          logger.info('Iframes:', iframeInfo.length, 'total,', accessible, 'accessible');
        }

        if (engines2.length > 0) {
          var names = engines2.map(function (e) { return e.name; });
          statusParts2.push('Engine: ' + names.join(', '));
          logger.info('Detected engines:', names.join(', '));
        }

        if (wasmScanner._modules.length > 0) {
          var heapMB2 = (wasmScanner._modules[0].heapBuffer.byteLength / 1048576).toFixed(1);
          statusParts2.push('WASM: ' + wasmScanner._modules.length + ' module(s), ' + heapMB2 + 'MB');
          logger.info('WASM modules:', wasmScanner._modules.length);
        }

        // Check for cross-origin iframes — this triggers the frame guide
        var crossOriginIframes = iframeScanner.getCrossOriginInfo();
        if (crossOriginIframes.length > 0) {
          statusParts2.push(crossOriginIframes.length + ' cross-origin');
          logger.info('Cross-origin iframes:', crossOriginIframes.length,
            '- Game may be in:', crossOriginIframes[0].src);
        }

        if (statusParts2.length > 0) {
          eventBus.emit('status:update', statusParts2.join(' | '));
        }

        // Set up bridge in parent mode
        if (WebEng.PostMessageBridge) {
          var bridge2 = new WebEng.PostMessageBridge(eventBus, 'parent');
          bridge2.start();
          window.__WEBENG__.bridge = bridge2;
          logger.info('PostMessage bridge started (parent role)');
        }
      }
    } catch (e) {
      logger.warn('Auto-detection failed:', e.message);
    }
  }, 2000);

  logger.info('WebEng loaded successfully. Press Ctrl+Shift+G to toggle UI.');
  console.log(
    '%c WebEng v1.0 %c Game Value Modifier Engine ' +
    (isIframeMode ? '%c IFRAME MODE ' : ''),
    'background:#00d4ff;color:#000;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;',
    'background:#1a1a2e;color:#00d4ff;padding:4px 8px;' +
    (isIframeMode ? 'border-radius:0;' : 'border-radius:0 4px 4px 0;'),
    isIframeMode ? 'background:#22aa44;color:#fff;font-weight:bold;padding:4px 8px;border-radius:0 4px 4px 0;' : ''
  );
  console.log(
    '%cAPI: __WEBENG__.scan(value) | __WEBENG__.set(path, value) | __WEBENG__.freeze(path, value) | __WEBENG__.detectEngine()',
    'color:#888;font-size:11px;'
  );
  if (isIframeMode) {
    console.log(
      '%cRunning in IFRAME MODE — scanning current frame directly.',
      'color:#22aa44;font-size:11px;font-weight:bold;'
    );
  }
})();
