/**
 * WebEng Scanner — first scan / next scan workflow with comparators
 */
(function () {
  'use strict';

  class Scanner {
    constructor(objectWalker, pathResolver, eventBus) {
      this.walker = objectWalker;
      this.pathResolver = pathResolver;
      this.eventBus = eventBus;
      this.scanResults = [];
      this.scanCount = 0;
      this.isScanning = false;
    }

    /**
     * First scan: walk the entire object graph and filter by value/type/comparator.
     */
    async firstScan(targetValue, targetType, comparator) {
      this.scanCount = 1;
      this.isScanning = true;
      this.eventBus.emit('scan:start', { scanNumber: 1 });

      this.walker.reset();
      await this.walker.walkAsync();

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

      for (var i = 0; i < this.scanResults.length; i++) {
        var entry = this.scanResults[i];
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
          return a === t;
        case 'greater':
          return a > t;
        case 'less':
          return a < t;
        case 'not_equal':
          return a !== t;
        case 'between':
          // target should be "min,max" format
          var bounds = String(target).split(',');
          if (bounds.length === 2) {
            return a >= Number(bounds[0]) && a <= Number(bounds[1]);
          }
          return false;
        default:
          return a == t; // loose equality as fallback
      }
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Scanner = Scanner;
})();
