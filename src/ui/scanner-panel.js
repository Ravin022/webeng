/**
 * WebEng ScannerPanel — UI for first scan / next scan workflow
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

      // Scan info
      this.scanInfo = document.createElement('div');
      this.scanInfo.style.cssText = 'font-size:11px;color:#666;margin-bottom:8px;';
      this.scanInfo.textContent = 'Enter a value and click First Scan to begin.';

      this.element.appendChild(row1);
      this.element.appendChild(row2);
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
