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
