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

        var iframeSc = window.__WEBENG__ && window.__WEBENG__.iframeScanner;
        if (iframeSc) {
          try { iframeSc.detectIframes(); } catch (e) { /* ignore */ }
        }

        var engines = WebEng.EngineDetector.detectAll(iframeSc);

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
            wasmSc.detectModules(iframeSc);
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
