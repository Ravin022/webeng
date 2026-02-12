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

      // Emit cross-origin event if any inaccessible iframes found
      var crossOrigin = results.filter(function (r) {
        return !r.accessible && r.src && r.src !== '(no src)';
      });
      if (crossOrigin.length > 0) {
        this.eventBus.emit('iframe:cross-origin-detected', {
          count: crossOrigin.length,
          iframes: this.getCrossOriginInfo()
        });
      }

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

    /**
     * Get detailed info about cross-origin (inaccessible) iframes.
     * Returns array sorted by area descending (largest = most likely the game).
     */
    getCrossOriginInfo() {
      return this._iframeContexts
        .filter(function (ctx) { return !ctx.accessible && ctx.src && ctx.src !== '(no src)'; })
        .map(function (ctx) {
          var origin = '';
          try { origin = new URL(ctx.src).origin; } catch (e) { /* ignore */ }
          var area = 0;
          try {
            var w = ctx.iframe.offsetWidth || ctx.iframe.clientWidth || 0;
            var h = ctx.iframe.offsetHeight || ctx.iframe.clientHeight || 0;
            area = w * h;
          } catch (e) { /* ignore */ }
          return { index: ctx.index, src: ctx.src, origin: origin, area: area };
        })
        .sort(function (a, b) { return b.area - a.area; });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.IframeScanner = IframeScanner;
})();
