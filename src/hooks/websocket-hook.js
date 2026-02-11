/**
 * WebEng WebSocketHook — intercept WebSocket creation, send, and messages
 */
(function () {
  'use strict';

  class WebSocketHook {
    constructor(hookManager) {
      this.hookManager = hookManager;
      this.OriginalWebSocket = window.WebSocket;
      this.installed = false;
      this.activeConnections = [];
    }

    install() {
      if (this.installed) return;
      var self = this;
      var OriginalWS = this.OriginalWebSocket;

      // Create a wrapper constructor
      function WebEngWebSocket(url, protocols) {
        var ws;
        if (protocols !== undefined) {
          ws = new OriginalWS(url, protocols);
        } else {
          ws = new OriginalWS(url);
        }

        var connInfo = { url: url, ws: ws, created: Date.now() };
        self.activeConnections.push(connInfo);

        // Intercept send()
        var originalSend = ws.send.bind(ws);
        ws.send = function (data) {
          var msgInfo = {
            type: 'websocket',
            direction: 'outgoing',
            url: url,
            data: data,
            timestamp: Date.now()
          };

          self.hookManager.logWebSocketMessage(msgInfo);

          // Apply outgoing rules
          var modified = self._applyWsRules(msgInfo);
          originalSend(modified !== undefined ? modified : data);
        };

        // Intercept onmessage via property descriptor
        var userOnMessage = null;
        Object.defineProperty(ws, 'onmessage', {
          get: function () { return userOnMessage; },
          set: function (handler) {
            userOnMessage = function (event) {
              var msgInfo = {
                type: 'websocket',
                direction: 'incoming',
                url: url,
                data: event.data,
                timestamp: Date.now()
              };

              self.hookManager.logWebSocketMessage(msgInfo);

              // Apply incoming rules
              var modified = self._applyWsRules(msgInfo);

              if (modified !== undefined) {
                // Create new MessageEvent with modified data
                var modEvent = new MessageEvent('message', {
                  data: modified,
                  origin: event.origin,
                  lastEventId: event.lastEventId,
                  source: event.source,
                  ports: event.ports
                });
                handler.call(ws, modEvent);
              } else {
                handler.call(ws, event);
              }
            };
          },
          configurable: true
        });

        // Also intercept addEventListener for 'message' events
        var originalAddListener = ws.addEventListener.bind(ws);
        ws.addEventListener = function (type, listener, options) {
          if (type === 'message') {
            var wrappedListener = function (event) {
              var msgInfo = {
                type: 'websocket',
                direction: 'incoming',
                url: url,
                data: event.data,
                timestamp: Date.now()
              };
              self.hookManager.logWebSocketMessage(msgInfo);
              listener.call(ws, event);
            };
            return originalAddListener(type, wrappedListener, options);
          }
          return originalAddListener(type, listener, options);
        };

        return ws;
      }

      // Copy static properties from original WebSocket
      WebEngWebSocket.CONNECTING = OriginalWS.CONNECTING;
      WebEngWebSocket.OPEN = OriginalWS.OPEN;
      WebEngWebSocket.CLOSING = OriginalWS.CLOSING;
      WebEngWebSocket.CLOSED = OriginalWS.CLOSED;
      WebEngWebSocket.prototype = OriginalWS.prototype;

      window.WebSocket = WebEngWebSocket;
      this.installed = true;
    }

    uninstall() {
      if (!this.installed) return;
      window.WebSocket = this.OriginalWebSocket;
      this.installed = false;
    }

    _applyWsRules(msgInfo) {
      var data = msgInfo.data;
      if (typeof data !== 'string') {
        try {
          data = JSON.stringify(data);
        } catch (e) {
          return undefined;
        }
      }

      var modified = false;
      var result = data;
      var rules = this.hookManager.getRules();

      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule.enabled) continue;

        // Check URL match
        if (!rule.urlRegex.test(msgInfo.url)) continue;

        // Check direction matching (use target: 'request' for outgoing, 'response' for incoming)
        var matchDir = (msgInfo.direction === 'outgoing' && rule.target === 'request') ||
          (msgInfo.direction === 'incoming' && rule.target === 'response');
        if (!matchDir) continue;

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
          }
        }
      }

      return modified ? result : undefined;
    }

    getActiveConnections() {
      return this.activeConnections.map(function (c) {
        return {
          url: c.url,
          created: c.created,
          readyState: c.ws.readyState
        };
      });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.WebSocketHook = WebSocketHook;
})();
