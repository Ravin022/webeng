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
