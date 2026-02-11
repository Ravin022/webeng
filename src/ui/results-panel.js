/**
 * WebEng ResultsPanel — scan results table with modify, freeze, bookmark
 */
(function () {
  'use strict';

  class ResultsPanel {
    constructor(modifier, pathResolver, eventBus) {
      this.modifier = modifier;
      this.pathResolver = pathResolver;
      this.eventBus = eventBus;
      this.element = null;
      this.resultsContainer = null;
      this.bookmarksContainer = null;
      this.currentResults = [];
    }

    render() {
      this.element = document.createElement('div');
      this.element.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow:hidden;';

      // Results table container
      this.resultsContainer = document.createElement('div');
      this.resultsContainer.className = 'webeng-results-container';
      this.resultsContainer.style.flex = '1';
      this.resultsContainer.innerHTML =
        '<div class="webeng-empty">No scan results yet.<br>Use the Scanner tab to find values.</div>';

      // Bookmarks section
      this.bookmarksContainer = document.createElement('div');
      this.bookmarksContainer.className = 'webeng-bookmarks';
      this.bookmarksContainer.style.display = 'none';

      this.element.appendChild(this.resultsContainer);
      this.element.appendChild(this.bookmarksContainer);

      this._bindEvents();

      return this.element;
    }

    _bindEvents() {
      var self = this;

      this.eventBus.on('scan:complete', function (data) {
        self.currentResults = data.results || [];
        self._renderResults(data.results, data.resultCount);
      });

      this.eventBus.on('scan:reset', function () {
        self.currentResults = [];
        self.resultsContainer.innerHTML =
          '<div class="webeng-empty">No scan results yet.<br>Use the Scanner tab to find values.</div>';
      });

      this.eventBus.on('bookmark:added', function () {
        self._renderBookmarks();
      });

      this.eventBus.on('bookmark:removed', function () {
        self._renderBookmarks();
      });
    }

    _renderResults(results, totalCount) {
      if (!results || results.length === 0) {
        this.resultsContainer.innerHTML =
          '<div class="webeng-empty">No matching values found.</div>';
        return;
      }

      var html = '<table class="webeng-results-table">' +
        '<thead><tr>' +
        '<th>Path</th>' +
        '<th>Value</th>' +
        '<th>Type</th>' +
        '<th>Actions</th>' +
        '</tr></thead><tbody>';

      var displayResults = results.slice(0, 500);

      for (var i = 0; i < displayResults.length; i++) {
        var r = displayResults[i];
        var shortPath = r.path.length > 40 ?
          '...' + r.path.substring(r.path.length - 37) : r.path;
        var displayVal = this._escapeHtml(String(r.value));
        if (displayVal.length > 30) {
          displayVal = displayVal.substring(0, 27) + '...';
        }

        var frozenClass = this.modifier.isFrozen(r.path) ? ' style="color:#ff9800"' : '';

        html += '<tr data-index="' + i + '">' +
          '<td title="' + this._escapeHtml(r.path) + '">' + this._escapeHtml(shortPath) + '</td>' +
          '<td' + frozenClass + '>' + displayVal + '</td>' +
          '<td>' + r.type + '</td>' +
          '<td class="webeng-results-actions">' +
          '<button class="webeng-btn small" data-action="edit" data-index="' + i + '">Edit</button>' +
          '<button class="webeng-btn small ' +
          (this.modifier.isFrozen(r.path) ? 'danger' : 'secondary') +
          '" data-action="freeze" data-index="' + i + '">' +
          (this.modifier.isFrozen(r.path) ? 'Unfreeze' : 'Freeze') + '</button>' +
          '<button class="webeng-btn small secondary" data-action="bookmark" data-index="' + i + '">+BM</button>' +
          '</td></tr>';
      }

      html += '</tbody></table>';

      if (totalCount > 500) {
        html += '<div style="padding:8px;font-size:11px;color:#666;text-align:center;">' +
          'Showing 500 of ' + totalCount + ' results. Narrow your search.</div>';
      }

      this.resultsContainer.innerHTML = html;

      // Bind action buttons
      var self = this;
      this.resultsContainer.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var index = parseInt(btn.getAttribute('data-index'));
        var result = self.currentResults[index];
        if (!result) return;

        if (action === 'edit') {
          self._showEditInline(btn, result, index);
        } else if (action === 'freeze') {
          self._toggleFreeze(result, btn);
        } else if (action === 'bookmark') {
          self.modifier.addBookmark(result.path);
        }
      });
    }

    _showEditInline(btn, result, index) {
      var td = btn.closest('td');
      var row = btn.closest('tr');
      var valueCell = row.querySelectorAll('td')[1];

      // Replace value cell with inline editor
      var container = document.createElement('div');
      container.className = 'webeng-inline-edit';

      var input = document.createElement('input');
      input.type = 'text';
      input.value = String(result.value);

      var okBtn = document.createElement('button');
      okBtn.className = 'webeng-btn small success';
      okBtn.textContent = 'OK';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'webeng-btn small secondary';
      cancelBtn.textContent = 'X';

      container.appendChild(input);
      container.appendChild(okBtn);
      container.appendChild(cancelBtn);

      var originalContent = valueCell.innerHTML;
      valueCell.innerHTML = '';
      valueCell.appendChild(container);
      input.focus();
      input.select();

      var self = this;

      function apply() {
        var success = self.modifier.setValue(result.path, input.value);
        if (success) {
          // Read back the actual value
          try {
            var newVal = self.pathResolver.resolveValue(result.path);
            result.value = newVal;
            valueCell.textContent = String(newVal);
          } catch (e) {
            valueCell.textContent = input.value;
          }
        } else {
          valueCell.innerHTML = originalContent;
        }
      }

      function cancel() {
        valueCell.innerHTML = originalContent;
      }

      okBtn.addEventListener('click', apply);
      cancelBtn.addEventListener('click', cancel);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') apply();
        if (e.key === 'Escape') cancel();
      });
    }

    _toggleFreeze(result, btn) {
      if (this.modifier.isFrozen(result.path)) {
        this.modifier.unfreeze(result.path);
        btn.textContent = 'Freeze';
        btn.className = 'webeng-btn small secondary';
      } else {
        this.modifier.freeze(result.path, result.value);
        btn.textContent = 'Unfreeze';
        btn.className = 'webeng-btn small danger';
      }
    }

    _renderBookmarks() {
      var bookmarks = this.modifier.getBookmarks();

      if (bookmarks.length === 0) {
        this.bookmarksContainer.style.display = 'none';
        return;
      }

      this.bookmarksContainer.style.display = 'block';
      var html = '<div class="webeng-bookmarks-title">Bookmarks</div>';

      for (var i = 0; i < bookmarks.length; i++) {
        var b = bookmarks[i];
        html += '<div class="webeng-bookmark-item">' +
          '<span class="webeng-bookmark-path" title="' + this._escapeHtml(b.path) + '">' +
          this._escapeHtml(b.label) + '</span>' +
          '<span class="webeng-bookmark-value">' + this._escapeHtml(String(b.value)) + '</span>' +
          '<div>' +
          '<button class="webeng-btn small" data-bm-edit="' + i + '">Edit</button> ' +
          '<button class="webeng-btn small danger" data-bm-remove="' + this._escapeHtml(b.path) + '">X</button>' +
          '</div></div>';
      }

      this.bookmarksContainer.innerHTML = html;

      // Bind bookmark actions
      var self = this;
      this.bookmarksContainer.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('[data-bm-remove]');
        if (removeBtn) {
          self.modifier.removeBookmark(removeBtn.getAttribute('data-bm-remove'));
        }
      });
    }

    _escapeHtml(str) {
      return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.ResultsPanel = ResultsPanel;
})();
