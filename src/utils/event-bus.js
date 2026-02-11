/**
 * WebEng EventBus — lightweight pub/sub message broker
 */
(function () {
  'use strict';

  class EventBus {
    constructor() {
      this._listeners = new Map();
    }

    on(event, callback) {
      if (!this._listeners.has(event)) {
        this._listeners.set(event, []);
      }
      this._listeners.get(event).push(callback);
      // Return unsubscribe function
      return () => this.off(event, callback);
    }

    off(event, callback) {
      const list = this._listeners.get(event);
      if (list) {
        this._listeners.set(event, list.filter(cb => cb !== callback));
      }
    }

    emit(event, data) {
      const list = this._listeners.get(event);
      if (list) {
        for (const cb of list) {
          try {
            cb(data);
          } catch (e) {
            console.error('[WebEng] EventBus error in handler for "' + event + '":', e);
          }
        }
      }
    }

    once(event, callback) {
      const unsub = this.on(event, (data) => {
        unsub();
        callback(data);
      });
      return unsub;
    }

    clear() {
      this._listeners.clear();
    }
  }

  // Attach to global namespace
  window.WebEng = window.WebEng || {};
  window.WebEng.EventBus = EventBus;
})();
