/**
 * WebEng XHRHook — monkey-patch XMLHttpRequest for interception
 */
(function () {
  'use strict';

  var SYM_METHOD = Symbol('webeng_method');
  var SYM_URL = Symbol('webeng_url');
  var SYM_BODY = Symbol('webeng_body');

  class XHRHook {
    constructor(hookManager) {
      this.hookManager = hookManager;
      this.originalOpen = XMLHttpRequest.prototype.open;
      this.originalSend = XMLHttpRequest.prototype.send;
      this.installed = false;
    }

    install() {
      if (this.installed) return;
      var self = this;

      // Patch open to capture method and URL
      XMLHttpRequest.prototype.open = function (method, url) {
        this[SYM_METHOD] = method;
        this[SYM_URL] = String(url);
        return self.originalOpen.apply(this, arguments);
      };

      // Patch send to intercept request/response
      XMLHttpRequest.prototype.send = function (body) {
        this[SYM_BODY] = body;
        var xhr = this;
        var hookMgr = self.hookManager;

        var requestInfo = {
          type: 'xhr',
          method: xhr[SYM_METHOD] || 'GET',
          url: xhr[SYM_URL] || '',
          body: body,
          timestamp: Date.now()
        };

        // Check for block
        if (hookMgr.shouldBlock(requestInfo.url)) {
          hookMgr.logRequest(Object.assign({}, requestInfo, {
            status: 0,
            responseBody: '[BLOCKED]',
            blocked: true
          }));
          // Abort the request
          xhr.abort();
          return;
        }

        // Apply request body modification
        var modifiedBody = hookMgr.applyRules(requestInfo, 'request');
        var sendBody = (modifiedBody !== undefined && modifiedBody !== '__WEBENG_BLOCK__')
          ? modifiedBody : body;

        // Intercept the response
        xhr.addEventListener('load', function () {
          var responseInfo = {
            type: 'xhr',
            method: requestInfo.method,
            url: requestInfo.url,
            body: body,
            timestamp: requestInfo.timestamp,
            status: xhr.status,
            statusText: xhr.statusText,
            responseBody: '',
            responseTime: Date.now() - requestInfo.timestamp
          };

          // Read response
          try {
            responseInfo.responseBody = xhr.responseText;
          } catch (e) {
            responseInfo.responseBody = '[Could not read response]';
          }

          // Apply response modification rules
          var modifiedResponse = hookMgr.applyRules(responseInfo, 'response');

          if (modifiedResponse !== undefined && modifiedResponse !== '__WEBENG_BLOCK__') {
            // Override responseText and response on this instance
            try {
              Object.defineProperty(xhr, 'responseText', {
                value: modifiedResponse,
                writable: true,
                configurable: true
              });
            } catch (e) { /* best effort */ }

            try {
              Object.defineProperty(xhr, 'response', {
                value: modifiedResponse,
                writable: true,
                configurable: true
              });
            } catch (e) { /* best effort */ }

            responseInfo.modified = true;
            responseInfo.modifiedBody = modifiedResponse;
          }

          hookMgr.logRequest(responseInfo);
        });

        xhr.addEventListener('error', function () {
          hookMgr.logRequest({
            type: 'xhr',
            method: requestInfo.method,
            url: requestInfo.url,
            timestamp: requestInfo.timestamp,
            status: 0,
            responseBody: '[Network Error]',
            error: true,
            responseTime: Date.now() - requestInfo.timestamp
          });
        });

        return self.originalSend.call(xhr, sendBody);
      };

      this.installed = true;
    }

    uninstall() {
      if (!this.installed) return;
      XMLHttpRequest.prototype.open = this.originalOpen;
      XMLHttpRequest.prototype.send = this.originalSend;
      this.installed = false;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.XHRHook = XHRHook;
})();
