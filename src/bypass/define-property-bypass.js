/**
 * WebEng DefinePropertyBypass — force writable/configurable on defineProperty calls
 */
(function () {
  'use strict';

  class DefinePropertyBypass {
    constructor() {
      this.originalDefineProperty = Object.defineProperty;
      this.originalDefineProperties = Object.defineProperties;
      this.enabled = false;
    }

    enable() {
      if (this.enabled) return;
      var original = this.originalDefineProperty;
      var originalMulti = this.originalDefineProperties;

      Object.defineProperty = function (obj, prop, descriptor) {
        var modified = Object.assign({}, descriptor);

        // If it's a data descriptor, force writable and configurable
        if (!('get' in modified) && !('set' in modified)) {
          if ('writable' in modified) {
            modified.writable = true;
          }
        }

        // Always force configurable so we can re-define later
        if ('configurable' in modified) {
          modified.configurable = true;
        }

        return original.call(Object, obj, prop, modified);
      };

      Object.defineProperties = function (obj, descriptors) {
        var modified = {};
        for (var key in descriptors) {
          if (descriptors.hasOwnProperty(key)) {
            var desc = Object.assign({}, descriptors[key]);
            if (!('get' in desc) && !('set' in desc)) {
              if ('writable' in desc) desc.writable = true;
            }
            if ('configurable' in desc) desc.configurable = true;
            modified[key] = desc;
          }
        }
        return originalMulti.call(Object, obj, modified);
      };

      this.enabled = true;
    }

    disable() {
      if (!this.enabled) return;
      Object.defineProperty = this.originalDefineProperty;
      Object.defineProperties = this.originalDefineProperties;
      this.enabled = false;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.DefinePropertyBypass = DefinePropertyBypass;
})();
