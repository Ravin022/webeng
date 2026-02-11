/**
 * WebEng Logger — leveled internal logging
 */
(function () {
  'use strict';

  const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

  class Logger {
    constructor(level) {
      this._level = LEVELS[level] !== undefined ? LEVELS[level] : LEVELS.info;
      this._history = [];
      this._maxHistory = 500;
    }

    setLevel(level) {
      if (LEVELS[level] !== undefined) {
        this._level = LEVELS[level];
      }
    }

    _log(level, prefix, args) {
      const entry = {
        level,
        timestamp: Date.now(),
        message: args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
      };
      this._history.push(entry);
      if (this._history.length > this._maxHistory) {
        this._history.shift();
      }
      if (LEVELS[level] >= this._level) {
        console[level === 'debug' ? 'log' : level](prefix, ...args);
      }
    }

    debug(...args) { this._log('debug', '[WebEng DEBUG]', args); }
    info(...args)  { this._log('info',  '[WebEng]', args); }
    warn(...args)  { this._log('warn',  '[WebEng WARN]', args); }
    error(...args) { this._log('error', '[WebEng ERROR]', args); }

    getHistory() {
      return this._history.slice();
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Logger = Logger;
})();
