/**
 * WebEng PostMessageBridge — enables communication between WebEng instances
 * running in different frame contexts (parent page <-> game iframe).
 * Uses a unique protocol key to avoid collision with game SDKs (Poki, CrazyGames, etc.).
 */
(function () {
  'use strict';

  var PROTOCOL = '__WEBENG_BRIDGE__';
  var VERSION = 1;

  class PostMessageBridge {
    constructor(eventBus, role) {
      this.eventBus = eventBus;
      this.role = role; // 'parent' or 'iframe'
      this._handler = this._onMessage.bind(this);
      this._peerReady = false;
      this._nextMsgId = 1;
    }

    /**
     * Start listening for messages and announce presence.
     */
    start() {
      window.addEventListener('message', this._handler);
      this._broadcast({ type: 'handshake', role: this.role });

      // Re-send handshake after a short delay in case peer loaded later
      var self = this;
      setTimeout(function () {
        if (!self._peerReady) {
          self._broadcast({ type: 'handshake', role: self.role });
        }
      }, 3000);
    }

    /**
     * Stop listening.
     */
    stop() {
      window.removeEventListener('message', this._handler);
    }

    /**
     * Send a message to the peer.
     */
    _broadcast(payload) {
      var msg = {
        protocol: PROTOCOL,
        version: VERSION,
        id: this._nextMsgId++,
        payload: payload
      };

      if (this.role === 'parent') {
        // Send to all iframes
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
          try {
            iframes[i].contentWindow.postMessage(msg, '*');
          } catch (e) { /* cross-origin postMessage still works */ }
        }
      } else {
        // Send to parent
        try {
          window.parent.postMessage(msg, '*');
        } catch (e) { /* ignore */ }
      }
    }

    /**
     * Handle incoming messages.
     */
    _onMessage(event) {
      var data = event.data;
      if (!data || data.protocol !== PROTOCOL) return;
      if (data.version !== VERSION) return;

      var payload = data.payload;
      if (!payload) return;

      // Ignore messages from same role
      if (payload.role === this.role) return;

      switch (payload.type) {
        case 'handshake':
          this._peerReady = true;
          this._broadcast({ type: 'handshake-ack', role: this.role });
          this.eventBus.emit('bridge:connected', { peerRole: payload.role });
          break;

        case 'handshake-ack':
          this._peerReady = true;
          this.eventBus.emit('bridge:connected', { peerRole: payload.role });
          break;

        case 'scan-results':
          this.eventBus.emit('bridge:scan-results', {
            results: payload.results || [],
            scanNumber: payload.scanNumber
          });
          break;

        case 'command':
          this._handleCommand(payload);
          break;

        case 'status':
          this.eventBus.emit('bridge:status', { text: payload.text });
          break;
      }
    }

    /**
     * Send scan results from iframe to parent.
     */
    sendScanResults(results, scanNumber) {
      this._broadcast({
        type: 'scan-results',
        results: results.map(function (r) {
          return { path: r.path, value: r.value, type: r.type };
        }).slice(0, 500), // Limit for postMessage serialization
        scanNumber: scanNumber
      });
    }

    /**
     * Send a command from parent to iframe.
     */
    sendCommand(cmd, args) {
      this._broadcast({
        type: 'command',
        cmd: cmd,
        args: args
      });
    }

    /**
     * Send a status message to the peer.
     */
    sendStatus(text) {
      this._broadcast({ type: 'status', text: text });
    }

    /**
     * Handle commands received from the peer.
     */
    _handleCommand(payload) {
      var webeng = window.__WEBENG__;
      if (!webeng) return;

      var self = this;
      switch (payload.cmd) {
        case 'scan':
          webeng.scan(payload.args.value, payload.args.type, payload.args.comparator)
            .then(function () {
              var results = webeng.scanner.lastResults || [];
              self.sendScanResults(results, webeng.scanner.scanCount);
              self.sendStatus('Scan complete: ' + results.length + ' result(s)');
            });
          break;

        case 'nextScan':
          webeng.nextScan(payload.args.value, payload.args.comparator)
            .then(function () {
              var results = webeng.scanner.lastResults || [];
              self.sendScanResults(results, webeng.scanner.scanCount);
              self.sendStatus('Next scan: ' + results.length + ' result(s)');
            });
          break;

        case 'set':
          webeng.set(payload.args.path, payload.args.value);
          self.sendStatus('Value set: ' + payload.args.path);
          break;

        case 'freeze':
          webeng.freeze(payload.args.path, payload.args.value);
          self.sendStatus('Frozen: ' + payload.args.path);
          break;

        case 'unfreeze':
          webeng.unfreeze(payload.args.path);
          self.sendStatus('Unfrozen: ' + payload.args.path);
          break;
      }
    }

    /**
     * Check if peer is connected.
     */
    isPeerReady() {
      return this._peerReady;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.PostMessageBridge = PostMessageBridge;
})();
