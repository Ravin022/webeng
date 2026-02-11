/**
 * WebEng Modifier — set values and freeze/unfreeze them
 */
(function () {
  'use strict';

  class Modifier {
    constructor(pathResolver, eventBus) {
      this.pathResolver = pathResolver;
      this.eventBus = eventBus;
      this.frozenValues = new Map(); // path -> { value, intervalId }
      this.bookmarks = [];           // saved paths for quick access
    }

    /**
     * Set a value at the given path with optional type coercion.
     */
    setValue(path, newValue, targetType) {
      if (targetType) {
        newValue = WebEng.TypeDetector.coerce(newValue, targetType);
      } else {
        // Auto-detect from current value type
        try {
          var current = this.pathResolver.resolveValue(path);
          var currentType = typeof current;
          if (currentType === 'number') {
            newValue = Number(newValue);
          } else if (currentType === 'boolean') {
            newValue = (newValue === 'true' || newValue === true || newValue === '1');
          }
        } catch (e) { /* use as-is */ }
      }

      var success = this.pathResolver.setValue(path, newValue);
      this.eventBus.emit('value:modified', { path: path, newValue: newValue, success: success });
      return success;
    }

    /**
     * Freeze a value — continuously re-apply it every 50ms.
     */
    freeze(path, value) {
      // Clear existing freeze on this path
      if (this.frozenValues.has(path)) {
        this.unfreeze(path);
      }

      var self = this;
      var intervalId = setInterval(function () {
        self.pathResolver.setValue(path, value);
      }, 50);

      this.frozenValues.set(path, { value: value, intervalId: intervalId });
      this.eventBus.emit('value:frozen', { path: path, value: value });
    }

    /**
     * Stop freezing a value.
     */
    unfreeze(path) {
      var entry = this.frozenValues.get(path);
      if (entry) {
        clearInterval(entry.intervalId);
        this.frozenValues.delete(path);
        this.eventBus.emit('value:unfrozen', { path: path });
      }
    }

    /**
     * Check if a path is currently frozen.
     */
    isFrozen(path) {
      return this.frozenValues.has(path);
    }

    /**
     * Get all frozen paths with their values.
     */
    getFrozenList() {
      var list = [];
      this.frozenValues.forEach(function (entry, path) {
        list.push({ path: path, value: entry.value });
      });
      return list;
    }

    /**
     * Unfreeze all values.
     */
    unfreezeAll() {
      var self = this;
      this.frozenValues.forEach(function (entry, path) {
        clearInterval(entry.intervalId);
      });
      this.frozenValues.clear();
      this.eventBus.emit('value:allUnfrozen');
    }

    /**
     * Bookmark a path for quick future access.
     */
    addBookmark(path, label) {
      this.bookmarks.push({
        path: path,
        label: label || path.split('.').pop(),
        created: Date.now()
      });
      this.eventBus.emit('bookmark:added', { path: path, label: label });
    }

    /**
     * Remove a bookmark by path.
     */
    removeBookmark(path) {
      this.bookmarks = this.bookmarks.filter(function (b) { return b.path !== path; });
      this.eventBus.emit('bookmark:removed', { path: path });
    }

    /**
     * Get all bookmarks with current values.
     */
    getBookmarks() {
      var self = this;
      return this.bookmarks.map(function (b) {
        var value;
        try {
          value = self.pathResolver.resolveValue(b.path);
        } catch (e) {
          value = '<error>';
        }
        return { path: b.path, label: b.label, value: value, created: b.created };
      });
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Modifier = Modifier;
})();
