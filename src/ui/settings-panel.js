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
