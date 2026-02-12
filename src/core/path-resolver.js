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
