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
