/**
 * WebEng AntiTamper — orchestrator for all bypass mechanisms
 */
(function () {
  'use strict';

  class AntiTamper {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.freezeBypass = new WebEng.FreezeBypass();
      this.definePropertyBypass = new WebEng.DefinePropertyBypass();
      this.timerBypass = new WebEng.TimerBypass(eventBus);
      this._domObserverActive = false;
      this._originalQuerySelector = null;
    }

    /**
     * Enable all bypass mechanisms.
     */
    enableAll() {
      this.freezeBypass.enable();
      this.definePropertyBypass.enable();
      this.timerBypass.enable();
      this._enableDOMStealth();
    }

    /**
     * Disable all bypass mechanisms.
     */
    disableAll() {
      this.freezeBypass.disable();
      this.definePropertyBypass.disable();
      this.timerBypass.disable();
      this._disableDOMStealth();
    }

    /**
     * Enable/disable individual modules.
     */
    setEnabled(module, enabled) {
      var target = this._getModule(module);
      if (!target) return;

      if (enabled) {
        target.enable();
      } else {
        target.disable();
      }
    }

    isEnabled(module) {
      var target = this._getModule(module);
      return target ? target.enabled : false;
    }

    _getModule(name) {
      switch (name) {
        case 'freeze': return this.freezeBypass;
        case 'defineProperty': return this.definePropertyBypass;
        case 'timer': return this.timerBypass;
        default: return null;
      }
    }

    /**
     * Get status of all bypass modules.
     */
    getStatus() {
      return {
        freeze: this.freezeBypass.enabled,
        defineProperty: this.definePropertyBypass.enabled,
        timer: this.timerBypass.enabled,
        domStealth: this._domObserverActive
      };
    }

    /**
     * Enable DOM stealth mode — hide WebEng from document.querySelectorAll etc.
     */
    _enableDOMStealth() {
      if (this._domObserverActive) return;

      this._originalQuerySelector = document.querySelectorAll.bind(document);
      var originalQS = document.querySelector.bind(document);

      document.querySelectorAll = function () {
        var results = this._originalQuerySelector.apply(document, arguments);
        // Filter out webeng-root
        return Array.prototype.filter.call(results, function (el) {
          return el.id !== 'webeng-root';
        });
      }.bind(this);

      document.querySelector = function () {
        var result = originalQS.apply(document, arguments);
        if (result && result.id === 'webeng-root') return null;
        return result;
      };

      this._domObserverActive = true;
    }

    _disableDOMStealth() {
      if (!this._domObserverActive) return;
      if (this._originalQuerySelector) {
        document.querySelectorAll = this._originalQuerySelector;
      }
      this._domObserverActive = false;
    }

    /**
     * Create an unfreeze proxy for an already-frozen object.
     * Convenience wrapper around FreezeBypass.createUnfreezeProxy.
     */
    unfreezeObject(frozenObj) {
      return WebEng.FreezeBypass.createUnfreezeProxy(frozenObj);
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.AntiTamper = AntiTamper;
})();
