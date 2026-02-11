/**
 * WebEng FreezeBypass — neuter Object.freeze/seal/preventExtensions
 */
(function () {
  'use strict';

  class FreezeBypass {
    constructor() {
      this.originalFreeze = Object.freeze;
      this.originalSeal = Object.seal;
      this.originalPreventExtensions = Object.preventExtensions;
      this.originalIsFrozen = Object.isFrozen;
      this.originalIsSealed = Object.isSealed;
      this.originalIsExtensible = Object.isExtensible;
      this.interceptedObjects = new WeakSet();
      this.enabled = false;
    }

    enable() {
      if (this.enabled) return;
      var self = this;

      // Replace Object.freeze with a no-op that tracks objects
      Object.freeze = function (obj) {
        if (obj && typeof obj === 'object') {
          self.interceptedObjects.add(obj);
        }
        return obj; // Return unfrozen
      };

      Object.seal = function (obj) {
        if (obj && typeof obj === 'object') {
          self.interceptedObjects.add(obj);
        }
        return obj;
      };

      Object.preventExtensions = function (obj) {
        if (obj && typeof obj === 'object') {
          self.interceptedObjects.add(obj);
        }
        return obj;
      };

      // Spoof checks so anti-tamper code thinks objects are still frozen
      Object.isFrozen = function (obj) {
        if (obj && typeof obj === 'object') {
          try {
            if (self.interceptedObjects.has(obj)) return true;
          } catch (e) { /* ignore */ }
        }
        return self.originalIsFrozen.call(Object, obj);
      };

      Object.isSealed = function (obj) {
        if (obj && typeof obj === 'object') {
          try {
            if (self.interceptedObjects.has(obj)) return true;
          } catch (e) { /* ignore */ }
        }
        return self.originalIsSealed.call(Object, obj);
      };

      Object.isExtensible = function (obj) {
        if (obj && typeof obj === 'object') {
          try {
            if (self.interceptedObjects.has(obj)) return false; // lie: say not extensible
          } catch (e) { /* ignore */ }
        }
        return self.originalIsExtensible.call(Object, obj);
      };

      this.enabled = true;
    }

    disable() {
      if (!this.enabled) return;
      Object.freeze = this.originalFreeze;
      Object.seal = this.originalSeal;
      Object.preventExtensions = this.originalPreventExtensions;
      Object.isFrozen = this.originalIsFrozen;
      Object.isSealed = this.originalIsSealed;
      Object.isExtensible = this.originalIsExtensible;
      this.enabled = false;
    }

    /**
     * Create a Proxy wrapper around an already-frozen object that allows writes.
     * Use this for objects that were frozen before the bypass was installed.
     */
    static createUnfreezeProxy(frozenObj) {
      var overrides = Object.create(null);
      var deletedKeys = new Set();

      return new Proxy(frozenObj, {
        get: function (target, prop) {
          if (deletedKeys.has(prop)) return undefined;
          if (prop in overrides) return overrides[prop];
          return target[prop];
        },
        set: function (target, prop, value) {
          deletedKeys.delete(prop);
          overrides[prop] = value;
          return true;
        },
        has: function (target, prop) {
          if (deletedKeys.has(prop)) return false;
          return prop in overrides || prop in target;
        },
        deleteProperty: function (target, prop) {
          delete overrides[prop];
          deletedKeys.add(prop);
          return true;
        },
        ownKeys: function (target) {
          var keys = new Set(Object.getOwnPropertyNames(target));
          Object.keys(overrides).forEach(function (k) { keys.add(k); });
          deletedKeys.forEach(function (k) { keys.delete(k); });
          return Array.from(keys);
        },
        getOwnPropertyDescriptor: function (target, prop) {
          if (deletedKeys.has(prop)) return undefined;
          if (prop in overrides) {
            return { value: overrides[prop], writable: true, enumerable: true, configurable: true };
          }
          return Object.getOwnPropertyDescriptor(target, prop);
        }
      });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.FreezeBypass = FreezeBypass;
})();
