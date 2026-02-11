/**
 * WebEng ObjectWalker — recursive traversal of the window object graph
 */
(function () {
  'use strict';

  // Properties/subtrees to skip (DOM, browser APIs, our own tool)
  const DEFAULT_SKIP = new Set([
    // Browser built-ins that are huge / irrelevant
    'document', 'location', 'navigator', 'chrome', 'performance',
    'caches', 'cookieStore', 'crypto', 'indexedDB', 'speechSynthesis',
    'visualViewport', 'screen', 'styleMedia', 'external', 'history',
    'clientInformation', 'devicePixelRatio', 'toolbar', 'menubar',
    'personalbar', 'scrollbars', 'statusbar', 'locationbar',
    // DOM / CSS
    'CSS', 'CSSStyleDeclaration', 'HTMLElement', 'Element', 'Node',
    'SVGElement', 'DocumentFragment', 'ShadowRoot',
    // Events
    'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent',
    // Frames
    'frames', 'parent', 'top', 'opener', 'self', 'window',
    // Storage
    'localStorage', 'sessionStorage',
    // Our own tool
    '__WEBENG__', 'WebEng',
    // Common noise
    'webkitURL', 'webkitStorageInfo', 'webkitRequestFileSystem',
    'webkitResolveLocalFileSystemURL', 'webkitMediaStream',
    'chrome', 'opr', '__coverage__', '__react', '__vue',
    // Constructor / prototype noise
    'constructor', 'prototype', '__proto__',
    'toString', 'toLocaleString', 'valueOf', 'hasOwnProperty',
    'isPrototypeOf', 'propertyIsEnumerable'
  ]);

  class ObjectWalker {
    constructor(options) {
      options = options || {};
      this.maxDepth = options.maxDepth || 7;
      this.skipKeys = new Set([...DEFAULT_SKIP, ...(options.extraSkip || [])]);
      this.visited = null;
      this.results = [];
      this._aborted = false;
      this._chunkSize = options.chunkSize || 500;
    }

    reset() {
      this.visited = new WeakSet();
      this.results = [];
      this._aborted = false;
    }

    abort() {
      this._aborted = true;
    }

    /**
     * Synchronous walk — fast but may freeze the page on large graphs.
     * Use walkAsync for production scans.
     */
    walk(root, path, depth) {
      root = root || window;
      path = path || 'window';
      depth = depth || 0;

      if (this._aborted) return;
      if (depth > this.maxDepth) return;
      if (root === null || root === undefined) return;

      const rootType = typeof root;
      if (rootType !== 'object' && rootType !== 'function') return;

      // Circular reference protection
      try {
        if (this.visited.has(root)) return;
        this.visited.add(root);
      } catch (e) {
        return;
      }

      // Skip DOM nodes
      try {
        if (root instanceof Node) return;
      } catch (e) { /* ignore */ }

      var keys;
      try {
        keys = Object.getOwnPropertyNames(root);
      } catch (e) {
        return;
      }

      for (var i = 0; i < keys.length; i++) {
        if (this._aborted) return;

        var key = keys[i];
        if (this.skipKeys.has(key)) continue;

        // Skip numeric-looking keys on non-array objects to avoid indexed DOM collections
        if (/^\d+$/.test(key) && !Array.isArray(root) && !ArrayBuffer.isView(root)) {
          continue;
        }

        var fullPath = path + '.' + key;
        var value;

        try {
          // Check for getters that might have side effects
          var desc = Object.getOwnPropertyDescriptor(root, key);
          if (desc && desc.get && !desc.set) {
            // Read-only getter — might be expensive or side-effectful, skip deep objects
            value = root[key];
          } else {
            value = root[key];
          }
        } catch (e) {
          continue;
        }

        var valType = typeof value;

        // Record scannable primitives
        if (valType === 'number' || valType === 'string' || valType === 'boolean') {
          this.results.push({ path: fullPath, value: value, type: valType });
        }

        // Recurse into objects/arrays
        if (valType === 'object' && value !== null) {
          this.walk(value, fullPath, depth + 1);
        }
      }
    }

    /**
     * Async walk — yields to the event loop every chunkSize properties
     * so the game/page stays responsive.
     */
    async walkAsync(root, path, depth, counter) {
      root = root || window;
      path = path || 'window';
      depth = depth || 0;
      counter = counter || { count: 0 };

      if (this._aborted) return;
      if (depth > this.maxDepth) return;
      if (root === null || root === undefined) return;

      var rootType = typeof root;
      if (rootType !== 'object' && rootType !== 'function') return;

      try {
        if (this.visited.has(root)) return;
        this.visited.add(root);
      } catch (e) {
        return;
      }

      try {
        if (root instanceof Node) return;
      } catch (e) { /* ignore */ }

      var keys;
      try {
        keys = Object.getOwnPropertyNames(root);
      } catch (e) {
        return;
      }

      for (var i = 0; i < keys.length; i++) {
        if (this._aborted) return;

        var key = keys[i];
        if (this.skipKeys.has(key)) continue;

        if (/^\d+$/.test(key) && !Array.isArray(root) && !ArrayBuffer.isView(root)) {
          continue;
        }

        var fullPath = path + '.' + key;
        var value;

        try {
          value = root[key];
        } catch (e) {
          continue;
        }

        var valType = typeof value;

        if (valType === 'number' || valType === 'string' || valType === 'boolean') {
          this.results.push({ path: fullPath, value: value, type: valType });
        }

        if (valType === 'object' && value !== null) {
          await this.walkAsync(value, fullPath, depth + 1, counter);
        }

        counter.count++;
        if (counter.count % this._chunkSize === 0) {
          // Yield to event loop
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.ObjectWalker = ObjectWalker;
})();
