/**
 * WebEng Overlay — Shadow DOM container with drag, minimize, hotkey toggle
 */
(function () {
  'use strict';

  class Overlay {
    constructor() {
      this.host = null;
      this.shadow = null;
      this.panel = null;
      this.visible = true;
      this.minimized = false;
      this._dragState = null;
      this._onKeyDown = this._onKeyDown.bind(this);
    }

    /**
     * Create and attach the overlay to the page.
     * Returns the shadow root for other UI modules to render into.
     */
    create() {
      // Create host element
      this.host = document.createElement('div');
      this.host.id = 'webeng-root';
      this.host.style.cssText =
        'all:initial;position:fixed;z-index:2147483647;top:10px;right:10px;' +
        'font-family:sans-serif;font-size:13px;';

      document.body.appendChild(this.host);

      // Create closed shadow DOM with delegatesFocus for better input handling
      this.shadow = this.host.attachShadow({ mode: 'closed', delegatesFocus: true });

      // Inject styles
      var style = document.createElement('style');
      style.textContent = WebEng.STYLES;
      this.shadow.appendChild(style);

      // Create main panel
      this.panel = document.createElement('div');
      this.panel.className = 'webeng-panel';
      this.shadow.appendChild(this.panel);

      // Title bar
      this._createTitleBar();

      // Body container (tabs + content are added by dashboard)
      this.body = document.createElement('div');
      this.body.className = 'webeng-body';
      this.panel.appendChild(this.body);

      // Status bar
      this.statusBar = document.createElement('div');
      this.statusBar.className = 'webeng-status';
      this.statusBar.innerHTML =
        '<span>WebEng v1.0</span>' +
        '<span class="count" id="webeng-status-text">Ready</span>';
      this.panel.appendChild(this.statusBar);

      // Setup drag
      this._setupDrag();

      // Setup keyboard shortcut
      document.addEventListener('keydown', this._onKeyDown, true);

      // Setup focus tracking for keyboard shield
      this._setupFocusTracking();

      return this.shadow;
    }

    _createTitleBar() {
      var titlebar = document.createElement('div');
      titlebar.className = 'webeng-titlebar';

      var title = document.createElement('span');
      title.className = 'webeng-title';
      title.textContent = 'WEBENG';

      var buttons = document.createElement('div');
      buttons.className = 'webeng-title-buttons';

      // Minimize button
      var minBtn = document.createElement('button');
      minBtn.className = 'webeng-title-btn';
      minBtn.innerHTML = '&#8211;';
      minBtn.title = 'Minimize';
      var self = this;
      minBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self.toggleMinimize();
      });

      // Close/hide button
      var closeBtn = document.createElement('button');
      closeBtn.className = 'webeng-title-btn';
      closeBtn.innerHTML = '&#10005;';
      closeBtn.title = 'Hide (Ctrl+Shift+G to show)';
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self.hide();
      });

      buttons.appendChild(minBtn);
      buttons.appendChild(closeBtn);
      titlebar.appendChild(title);
      titlebar.appendChild(buttons);
      this.panel.appendChild(titlebar);
      this.titlebar = titlebar;
    }

    _setupDrag() {
      var self = this;
      var titlebar = this.titlebar;

      titlebar.addEventListener('pointerdown', function (e) {
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        self._dragState = {
          startX: e.clientX,
          startY: e.clientY,
          startLeft: self.host.offsetLeft,
          startTop: self.host.offsetTop
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
      });

      function onMove(e) {
        if (!self._dragState) return;
        var dx = e.clientX - self._dragState.startX;
        var dy = e.clientY - self._dragState.startY;
        self.host.style.left = (self._dragState.startLeft + dx) + 'px';
        self.host.style.top = (self._dragState.startTop + dy) + 'px';
        self.host.style.right = 'auto';
      }

      function onUp() {
        self._dragState = null;
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
    }

    /**
     * Track focus on input elements inside shadow DOM.
     * Notifies the KeyboardShield when a WebEng input gains/loses focus,
     * so it can suppress game keyboard event interception.
     */
    _setupFocusTracking() {
      this.shadow.addEventListener('focusin', function (e) {
        var tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
          if (window.__WEBENG__ && window.__WEBENG__.antiTamper &&
              window.__WEBENG__.antiTamper.keyboardShield) {
            window.__WEBENG__.antiTamper.keyboardShield.setInputFocused(true);
          }
        }
      });

      this.shadow.addEventListener('focusout', function () {
        if (window.__WEBENG__ && window.__WEBENG__.antiTamper &&
            window.__WEBENG__.antiTamper.keyboardShield) {
          window.__WEBENG__.antiTamper.keyboardShield.setInputFocused(false);
        }
      });
    }

    _onKeyDown(e) {
      // Ctrl+Shift+G to toggle visibility
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      }
    }

    toggle() {
      if (this.visible) {
        this.hide();
      } else {
        this.show();
      }
    }

    show() {
      this.host.style.display = 'block';
      this.visible = true;
    }

    hide() {
      this.host.style.display = 'none';
      this.visible = false;
    }

    toggleMinimize() {
      this.minimized = !this.minimized;
      if (this.minimized) {
        this.panel.classList.add('minimized');
      } else {
        this.panel.classList.remove('minimized');
      }
    }

    setStatus(text) {
      var el = this.shadow.querySelector('#webeng-status-text');
      if (el) el.textContent = text;
    }

    getBody() {
      return this.body;
    }

    getShadow() {
      return this.shadow;
    }

    /**
     * Enable iframe mode — adds visual badge and adapts sizing for small viewports.
     */
    setIframeMode(enabled) {
      if (!enabled) return;
      // Add "IFRAME" badge next to title
      var title = this.titlebar.querySelector('.webeng-title');
      if (title) {
        var badge = document.createElement('span');
        badge.className = 'webeng-iframe-badge';
        badge.textContent = 'IFRAME';
        title.appendChild(badge);
      }

      // Adaptive sizing for small iframe viewports
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      if (vw < 600 || vh < 500) {
        this.panel.style.width = Math.min(380, vw - 20) + 'px';
        this.panel.style.height = Math.min(420, vh - 20) + 'px';
      }
    }

    destroy() {
      document.removeEventListener('keydown', this._onKeyDown, true);
      if (this.host && this.host.parentNode) {
        this.host.parentNode.removeChild(this.host);
      }
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Overlay = Overlay;
})();
