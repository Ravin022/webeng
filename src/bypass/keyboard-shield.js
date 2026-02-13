/**
 * WebEng KeyboardShield — prevents game code from blocking keyboard input
 * in WebEng's input fields.
 *
 * Games (especially on CrazyGames) register capture-phase keyboard event
 * listeners on document/window that call preventDefault() and stopPropagation(),
 * preventing typing in ANY input field on the page.
 *
 * This module patches Event.prototype methods to become no-ops when:
 *   1. The event is a KeyboardEvent
 *   2. A WebEng input field currently has focus
 *
 * This allows keyboard events to flow normally to WebEng inputs while
 * preserving game keyboard handling when WebEng inputs are not focused.
 */
(function () {
  'use strict';

  class KeyboardShield {
    constructor() {
      this.enabled = false;
      this._inputFocused = false;
      this._origPreventDefault = null;
      this._origStopPropagation = null;
      this._origStopImmediate = null;
    }

    /**
     * Enable the keyboard shield by patching Event.prototype methods.
     */
    enable() {
      if (this.enabled) return;
      this.enabled = true;

      var self = this;

      // Save original methods
      this._origPreventDefault = Event.prototype.preventDefault;
      this._origStopPropagation = Event.prototype.stopPropagation;
      this._origStopImmediate = Event.prototype.stopImmediatePropagation;

      // Patch preventDefault — skip for keyboard events when WebEng input focused
      Event.prototype.preventDefault = function () {
        if (self._inputFocused && this instanceof KeyboardEvent) {
          return;
        }
        return self._origPreventDefault.call(this);
      };

      // Patch stopPropagation — same logic
      Event.prototype.stopPropagation = function () {
        if (self._inputFocused && this instanceof KeyboardEvent) {
          return;
        }
        return self._origStopPropagation.call(this);
      };

      // Patch stopImmediatePropagation — same logic
      Event.prototype.stopImmediatePropagation = function () {
        if (self._inputFocused && this instanceof KeyboardEvent) {
          return;
        }
        return self._origStopImmediate.call(this);
      };
    }

    /**
     * Disable the keyboard shield and restore original methods.
     */
    disable() {
      if (!this.enabled) return;

      if (this._origPreventDefault) {
        Event.prototype.preventDefault = this._origPreventDefault;
      }
      if (this._origStopPropagation) {
        Event.prototype.stopPropagation = this._origStopPropagation;
      }
      if (this._origStopImmediate) {
        Event.prototype.stopImmediatePropagation = this._origStopImmediate;
      }

      this._origPreventDefault = null;
      this._origStopPropagation = null;
      this._origStopImmediate = null;
      this._inputFocused = false;
      this.enabled = false;
    }

    /**
     * Called by overlay.js focus tracking when a WebEng input gains/loses focus.
     */
    setInputFocused(focused) {
      this._inputFocused = !!focused;
    }

    /**
     * Check if a WebEng input is currently focused.
     */
    isInputFocused() {
      return this._inputFocused;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.KeyboardShield = KeyboardShield;
})();
