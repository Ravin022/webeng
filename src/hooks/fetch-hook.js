/**
 * WebEng FetchHook — monkey-patch the global fetch() function
 */
(function () {
  'use strict';

  class FetchHook {
    constructor(hookManager) {
      this.hookManager = hookManager;
      this.originalFetch = window.fetch ? window.fetch.bind(window) : null;
      this.installed = false;
    }

    install() {
      if (this.installed || !this.originalFetch) return;
      var self = this;

      window.fetch = function (input, init) {
        init = init || {};

        // Normalize input
        var url = (typeof input === 'string') ? input :
          (input instanceof Request ? input.url : String(input));
        var method = init.method ||
          (input instanceof Request ? input.method : 'GET');

        var requestInfo = {
          type: 'fetch',
          method: method.toUpperCase(),
          url: url,
          body: init.body,
          timestamp: Date.now()
        };

        // Check for block
        if (self.hookManager.shouldBlock(url)) {
          self.hookManager.logRequest(Object.assign({}, requestInfo, {
            status: 0,
            responseBody: '[BLOCKED]',
            blocked: true
          }));
          return Promise.reject(new Error('WebEng: Request blocked by rule'));
        }

        // Apply request modification rules
        var modifiedBody = self.hookManager.applyRules(requestInfo, 'request');
        if (modifiedBody !== undefined && modifiedBody !== '__WEBENG_BLOCK__') {
          init = Object.assign({}, init, { body: modifiedBody });
        }

        // Execute the actual fetch
        return self.originalFetch(input, init).then(function (response) {
          // Clone to read body without consuming the original
          var clone = response.clone();

          return clone.text().then(function (responseBody) {
            var responseInfo = {
              type: 'fetch',
              method: requestInfo.method,
              url: requestInfo.url,
              body: requestInfo.body,
              timestamp: requestInfo.timestamp,
              status: response.status,
              statusText: response.statusText,
              responseBody: responseBody,
              responseTime: Date.now() - requestInfo.timestamp
            };

            // Apply response modification rules
            var modifiedResponse = self.hookManager.applyRules(responseInfo, 'response');

            if (modifiedResponse !== undefined && modifiedResponse !== '__WEBENG_BLOCK__') {
              responseInfo.modified = true;
              responseInfo.modifiedBody = modifiedResponse;
              self.hookManager.logRequest(responseInfo);

              // Construct new Response with modified body
              return new Response(modifiedResponse, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
              });
            }

            self.hookManager.logRequest(responseInfo);
            return response;
          }).catch(function () {
            // If we can't read the body, just log and pass through
            self.hookManager.logRequest({
              type: 'fetch',
              method: requestInfo.method,
              url: requestInfo.url,
              timestamp: requestInfo.timestamp,
              status: response.status,
              responseBody: '[Could not read body]',
              responseTime: Date.now() - requestInfo.timestamp
            });
            return response;
          });
        }).catch(function (error) {
          self.hookManager.logRequest({
            type: 'fetch',
            method: requestInfo.method,
            url: requestInfo.url,
            timestamp: requestInfo.timestamp,
            status: 0,
            responseBody: '[Fetch Error: ' + error.message + ']',
            error: true,
            responseTime: Date.now() - requestInfo.timestamp
          });
          throw error;
        });
      };

      this.installed = true;
    }

    uninstall() {
      if (!this.installed || !this.originalFetch) return;
      window.fetch = this.originalFetch;
      this.installed = false;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.FetchHook = FetchHook;
})();
