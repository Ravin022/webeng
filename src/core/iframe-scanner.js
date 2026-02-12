/**
 * WebEng IframeScanner — detect and scan game iframes
 */
(function () {
  'use strict';

  class IframeScanner {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this._iframeContexts = [];
    }

    /**
     * Discover all iframes on the page.
     * Returns array of { index, iframe, contentWindow, accessible, src }
     */
    detectIframes() {
      this._iframeContexts = [];
      var iframes = document.querySelectorAll('iframe');
      var results = [];

      for (var i = 0; i < iframes.length; i++) {
        var iframe = iframes[i];
        var entry = {
          index: i,
          iframe: iframe,
          contentWindow: null,
          accessible: false,
          src: iframe.src || '(no src)'
        };

        try {
          var cw = iframe.contentWindow;
          // Same-origin test: accessing .document throws on cross-origin
          if (cw && cw.document) {
            entry.contentWindow = cw;
            entry.accessible = true;
          }
        } catch (e) {
          entry.accessible = false;
        }

        results.push(entry);
        this._iframeContexts.push(entry);
      }

      this.eventBus.emit('iframe:detected', {
        total: results.length,
        accessible: results.filter(function (r) { return r.accessible; }).length,
        iframes: results.map(function (r) {
          return { index: r.index, src: r.src, accessible: r.accessible };
        })
      });

      return results;
    }

    /**
     * Get accessible iframe contentWindows for scanning.
     */
    getAccessibleContexts() {
      return this._iframeContexts.filter(function (ctx) {
        return ctx.accessible && ctx.contentWindow;
      });
    }

    /**
     * Walk an iframe's object graph using the provided ObjectWalker.
     * Results are tagged with iframe-prefixed paths: "iframe[0].game.player.hp"
     * The walker should NOT be reset before this — we append to existing results.
     */
    async walkIframe(walker, ctx) {
      var prefix = 'iframe[' + ctx.index + ']';
      await walker.walkAsync(ctx.contentWindow, prefix, 0);
    }

    /**
     * Get detected iframe info for display.
     */
    getIframeInfo() {
      return this._iframeContexts.map(function (ctx) {
        return {
          index: ctx.index,
          src: ctx.src,
          accessible: ctx.accessible
        };
      });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.IframeScanner = IframeScanner;
})();
