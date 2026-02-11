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
     * Resolve a path string to the value it points to.
     */
    resolveValue: function (path) {
      var parts = this.parsePath(path);
      var current = window;

      // Skip 'window' prefix if present
      var start = (parts[0] === 'window') ? 1 : 0;

      for (var i = start; i < parts.length; i++) {
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
      var parts = this.parsePath(path);
      var current = window;
      var start = (parts[0] === 'window') ? 1 : 0;

      // Navigate to the parent of the target property
      for (var i = start; i < parts.length - 1; i++) {
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
