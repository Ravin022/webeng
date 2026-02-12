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
