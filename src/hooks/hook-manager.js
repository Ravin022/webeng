/**
 * WebEng HookManager — central registry for network interception rules and logging
 */
(function () {
  'use strict';

  class HookManager {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.rules = [];
      this.requestLog = [];
      this.wsLog = [];
      this._maxLog = 500;
      this._nextRuleId = 1;
    }

    /**
     * Add a modification rule.
     * @param {Object} rule - { name, urlPattern, target, action, find, replace, enabled }
     *   urlPattern: string (will be compiled to regex)
     *   target: 'request' | 'response'
     *   action: 'modify' | 'block' | 'delay'
     *   find: string or regex pattern to find in body
     *   replace: string to replace with
     */
    addRule(rule) {
      var compiled = {
        id: this._nextRuleId++,
        name: rule.name || 'Rule ' + this._nextRuleId,
        urlPattern: rule.urlPattern || '.*',
        urlRegex: null,
        target: rule.target || 'response',
        action: rule.action || 'modify',
        find: rule.find || '',
        replace: rule.replace !== undefined ? rule.replace : '',
        enabled: rule.enabled !== false
      };

      try {
        compiled.urlRegex = new RegExp(compiled.urlPattern);
      } catch (e) {
        compiled.urlRegex = new RegExp('.*');
      }

      this.rules.push(compiled);
      this.eventBus.emit('rule:added', compiled);
      return compiled;
    }

    removeRule(id) {
      this.rules = this.rules.filter(function (r) { return r.id !== id; });
      this.eventBus.emit('rule:removed', { id: id });
    }

    toggleRule(id) {
      for (var i = 0; i < this.rules.length; i++) {
        if (this.rules[i].id === id) {
          this.rules[i].enabled = !this.rules[i].enabled;
          this.eventBus.emit('rule:toggled', this.rules[i]);
          return this.rules[i];
        }
      }
      return null;
    }

    getRules() {
      return this.rules.slice();
    }

    /**
     * Apply matching rules to a request/response body.
     * Returns the modified body, or undefined if no rules matched.
     */
    applyRules(info, phase) {
      var body = (phase === 'request') ? info.body : info.responseBody;
      if (typeof body !== 'string') {
        try {
          body = JSON.stringify(body);
        } catch (e) {
          return undefined;
        }
      }

      var modified = false;
      var result = body;

      for (var i = 0; i < this.rules.length; i++) {
        var rule = this.rules[i];
        if (!rule.enabled) continue;
        if (rule.target !== phase) continue;

        // URL matching
        if (!rule.urlRegex.test(info.url)) continue;

        if (rule.action === 'block') {
          this.eventBus.emit('rule:applied', { rule: rule, info: info, action: 'block' });
          return '__WEBENG_BLOCK__';
        }

        if (rule.action === 'modify' && rule.find) {
          var findRegex;
          try {
            findRegex = new RegExp(rule.find, 'g');
          } catch (e) {
            findRegex = new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          }

          var newResult = result.replace(findRegex, rule.replace);
          if (newResult !== result) {
            result = newResult;
            modified = true;
            this.eventBus.emit('rule:applied', { rule: rule, info: info, action: 'modify' });
          }
        }
      }

      return modified ? result : undefined;
    }

    /**
     * Check if a request URL should be blocked.
     */
    shouldBlock(url) {
      for (var i = 0; i < this.rules.length; i++) {
        var rule = this.rules[i];
        if (!rule.enabled) continue;
        if (rule.action !== 'block') continue;
        if (rule.urlRegex.test(url)) return true;
      }
      return false;
    }

    /**
     * Log a request/response entry.
     */
    logRequest(info) {
      this.requestLog.push(info);
      if (this.requestLog.length > this._maxLog) {
        this.requestLog.shift();
      }
      this.eventBus.emit('request:logged', info);
    }

    /**
     * Log a WebSocket message.
     */
    logWebSocketMessage(info) {
      this.wsLog.push(info);
      if (this.wsLog.length > this._maxLog) {
        this.wsLog.shift();
      }
      this.eventBus.emit('websocket:logged', info);
    }

    /**
     * Get recent request log entries.
     */
    getRequestLog(limit) {
      limit = limit || 100;
      return this.requestLog.slice(-limit);
    }

    /**
     * Get recent WebSocket log entries.
     */
    getWebSocketLog(limit) {
      limit = limit || 100;
      return this.wsLog.slice(-limit);
    }

    /**
     * Clear all logs.
     */
    clearLogs() {
      this.requestLog = [];
      this.wsLog = [];
      this.eventBus.emit('logs:cleared');
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.HookManager = HookManager;
})();
