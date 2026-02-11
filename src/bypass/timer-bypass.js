/**
 * WebEng TimerBypass — track, block, and kill setInterval/setTimeout integrity checks
 */
(function () {
  'use strict';

  class TimerBypass {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.originalSetInterval = window.setInterval.bind(window);
      this.originalClearInterval = window.clearInterval.bind(window);
      this.originalSetTimeout = window.setTimeout.bind(window);
      this.originalClearTimeout = window.clearTimeout.bind(window);
      this.trackedIntervals = new Map();
      this.trackedTimeouts = new Map();
      this.blockedPatterns = [];
      this.enabled = false;
      this._nextId = 1;
    }

    enable() {
      if (this.enabled) return;
      var self = this;

      // Common anti-tamper patterns to auto-detect
      var suspiciousPatterns = [
        /location\s*\.\s*reload/,
        /debugger/,
        /devtool/i,
        /outerWidth\s*-\s*innerWidth/,
        /outerHeight\s*-\s*innerHeight/,
        /integrity/i,
        /tamper/i,
        /checksum/i
      ];

      window.setInterval = function (callback, interval) {
        var args = Array.prototype.slice.call(arguments, 2);
        var callbackStr = '';

        try {
          callbackStr = typeof callback === 'function' ?
            callback.toString() : String(callback);
        } catch (e) { /* ignore */ }

        // Check blocked patterns
        for (var i = 0; i < self.blockedPatterns.length; i++) {
          if (self.blockedPatterns[i].test(callbackStr)) {
            self.eventBus.emit('timer:blocked', {
              type: 'interval',
              source: callbackStr.substring(0, 200),
              interval: interval,
              pattern: self.blockedPatterns[i].toString()
            });
            return -(self._nextId++); // Return fake ID
          }
        }

        var id = self.originalSetInterval.apply(window, arguments);

        // Detect suspicious patterns
        var suspicious = false;
        for (var j = 0; j < suspiciousPatterns.length; j++) {
          if (suspiciousPatterns[j].test(callbackStr)) {
            suspicious = true;
            break;
          }
        }

        self.trackedIntervals.set(id, {
          source: callbackStr.substring(0, 300),
          interval: interval,
          created: Date.now(),
          suspicious: suspicious
        });

        self.eventBus.emit('timer:created', {
          type: 'interval',
          id: id,
          interval: interval,
          suspicious: suspicious,
          source: callbackStr.substring(0, 200)
        });

        return id;
      };

      window.setTimeout = function (callback, delay) {
        var callbackStr = '';
        try {
          callbackStr = typeof callback === 'function' ?
            callback.toString() : String(callback);
        } catch (e) { /* ignore */ }

        // Check blocked patterns
        for (var i = 0; i < self.blockedPatterns.length; i++) {
          if (self.blockedPatterns[i].test(callbackStr)) {
            return -(self._nextId++);
          }
        }

        var id = self.originalSetTimeout.apply(window, arguments);

        self.trackedTimeouts.set(id, {
          source: callbackStr.substring(0, 300),
          delay: delay,
          created: Date.now()
        });

        return id;
      };

      window.clearInterval = function (id) {
        self.trackedIntervals.delete(id);
        return self.originalClearInterval(id);
      };

      window.clearTimeout = function (id) {
        self.trackedTimeouts.delete(id);
        return self.originalClearTimeout(id);
      };

      this.enabled = true;
    }

    disable() {
      if (!this.enabled) return;
      window.setInterval = this.originalSetInterval;
      window.clearInterval = this.originalClearInterval;
      window.setTimeout = this.originalSetTimeout;
      window.clearTimeout = this.originalClearTimeout;
      this.enabled = false;
    }

    /**
     * Add a regex pattern to block matching timers.
     */
    addBlockPattern(regexStr) {
      try {
        this.blockedPatterns.push(new RegExp(regexStr));
      } catch (e) {
        this.blockedPatterns.push(new RegExp(
          regexStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        ));
      }
    }

    /**
     * Remove a block pattern by index.
     */
    removeBlockPattern(index) {
      this.blockedPatterns.splice(index, 1);
    }

    /**
     * Kill a specific interval.
     */
    killInterval(id) {
      this.originalClearInterval(id);
      this.trackedIntervals.delete(id);
      this.eventBus.emit('timer:killed', { type: 'interval', id: id });
    }

    /**
     * Kill all suspicious intervals.
     */
    killSuspicious() {
      var self = this;
      var killed = 0;
      this.trackedIntervals.forEach(function (info, id) {
        if (info.suspicious) {
          self.originalClearInterval(id);
          self.trackedIntervals.delete(id);
          killed++;
        }
      });
      this.eventBus.emit('timer:killedSuspicious', { count: killed });
      return killed;
    }

    /**
     * Get list of tracked intervals.
     */
    getIntervals() {
      var list = [];
      this.trackedIntervals.forEach(function (info, id) {
        list.push(Object.assign({ id: id }, info));
      });
      return list;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.TimerBypass = TimerBypass;
})();
