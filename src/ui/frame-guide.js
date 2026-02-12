/**
 * WebEng FrameGuide — step-by-step UI guiding users to inject WebEng
 * into cross-origin game iframes via DevTools frame context switching.
 */
(function () {
  'use strict';

  var PORTAL_TIPS = {
    'CrazyGames': 'CrazyGames loads games from games.crazygames.com — look for that domain in the frame dropdown.',
    'Poki': 'Poki loads games from various subdomains — look for the game URL (not poki.com) in the frame dropdown.',
    'Newgrounds': 'Newgrounds games may load from uploads.ungrounded.net or the game developer\'s domain.',
    'itch.io': 'itch.io games load from html-classic.itch.zone or html.itch.zone subdomains.',
    'Kongregate': 'Kongregate games load from various external domains.',
    'Armor Games': 'Armor Games loads games from files.armorgames.com or external domains.',
    'Game Distribution': 'Games load from html5.gamedistribution.com subdomains.',
    'Y8': 'Y8 games load from various game server domains.'
  };

  class FrameGuide {
    constructor(eventBus) {
      this.eventBus = eventBus;
      this.element = null;
      this._crossOriginIframes = [];
      this._portalInfo = null;
    }

    render() {
      this.element = document.createElement('div');
      this.element.className = 'webeng-tab-content webeng-frame-guide';
      this.element.style.display = 'none';

      // Banner
      this._banner = document.createElement('div');
      this._banner.className = 'webeng-frame-guide-banner';
      this._banner.textContent = 'Game is inside a cross-origin iframe';
      this.element.appendChild(this._banner);

      // Explanation
      var explain = document.createElement('div');
      explain.style.cssText = 'font-size:11px;color:#aaa;line-height:1.5;';
      explain.textContent =
        'The game runs in a separate domain inside an iframe. ' +
        'Due to browser security, WebEng cannot access game values from this page. ' +
        'Follow the steps below to inject WebEng directly into the game frame.';
      this.element.appendChild(explain);

      // Detected iframe info
      this._iframeInfoEl = document.createElement('div');
      this._iframeInfoEl.className = 'webeng-frame-guide-url';
      this._iframeInfoEl.textContent = '(detecting...)';
      this.element.appendChild(this._iframeInfoEl);

      // Steps container
      this._stepsEl = document.createElement('div');
      this._stepsEl.style.cssText = 'display:flex;flex-direction:column;';
      this.element.appendChild(this._stepsEl);

      this._renderSteps();

      // Portal tip
      this._tipEl = document.createElement('div');
      this._tipEl.className = 'webeng-frame-guide-tip';
      this._tipEl.style.display = 'none';
      this.element.appendChild(this._tipEl);

      // Dismiss button
      var dismissRow = document.createElement('div');
      dismissRow.style.cssText = 'display:flex;gap:8px;margin-top:4px;';

      var dismissBtn = document.createElement('button');
      dismissBtn.className = 'webeng-btn small secondary';
      dismissBtn.textContent = 'Dismiss';
      var self = this;
      dismissBtn.addEventListener('click', function () {
        self.hide();
        self.eventBus.emit('frameguide:dismissed');
      });
      dismissRow.appendChild(dismissBtn);

      this.element.appendChild(dismissRow);

      return this.element;
    }

    _renderSteps() {
      var steps = [
        'In the DevTools Console, look at the dropdown at the top-left of the console area. It usually shows "top" or the page URL.',
        'Click the dropdown and find the game frame — it will show the game\'s URL (see above).',
        'Select that frame. The console context will switch to the game iframe.',
        'Paste the WebEng script into the console again and press Enter. WebEng will load inside the game with full access to its values.'
      ];

      for (var i = 0; i < steps.length; i++) {
        var step = document.createElement('div');
        step.className = 'webeng-frame-guide-step';

        var num = document.createElement('div');
        num.className = 'webeng-frame-guide-num';
        num.textContent = String(i + 1);

        var text = document.createElement('div');
        text.style.cssText = 'flex:1;line-height:1.4;';
        text.textContent = steps[i];

        step.appendChild(num);
        step.appendChild(text);
        this._stepsEl.appendChild(step);
      }
    }

    /**
     * Show the guide with detected cross-origin iframe info.
     * @param {Array} crossOriginIframes - from ContextDetector.getCrossOriginIframes()
     * @param {Object|null} portalInfo - from ContextDetector.detectPortal()
     */
    show(crossOriginIframes, portalInfo) {
      this._crossOriginIframes = crossOriginIframes || [];
      this._portalInfo = portalInfo;

      // Update iframe info display
      if (this._crossOriginIframes.length > 0) {
        var primary = this._crossOriginIframes[0]; // Largest by area
        var desc = WebEng.ContextDetector.describeIframeUrl(primary.src);
        this._iframeInfoEl.innerHTML = '';

        var label = document.createElement('span');
        label.style.cssText = 'color:#aaa;font-size:10px;';
        label.textContent = 'Game frame URL (look for this in the dropdown):';
        this._iframeInfoEl.appendChild(label);

        var urlEl = document.createElement('div');
        urlEl.style.cssText = 'color:#00d4ff;margin-top:4px;word-break:break-all;';
        urlEl.textContent = primary.src;
        this._iframeInfoEl.appendChild(urlEl);

        if (primary.width > 0 && primary.height > 0) {
          var sizeEl = document.createElement('span');
          sizeEl.style.cssText = 'color:#666;font-size:10px;margin-top:2px;display:block;';
          sizeEl.textContent = primary.width + 'x' + primary.height + ' px — largest iframe (likely the game)';
          this._iframeInfoEl.appendChild(sizeEl);
        }

        if (this._crossOriginIframes.length > 1) {
          var otherEl = document.createElement('div');
          otherEl.style.cssText = 'color:#666;font-size:10px;margin-top:6px;border-top:1px solid #2a2a3c;padding-top:4px;';
          otherEl.textContent = (this._crossOriginIframes.length - 1) +
            ' other cross-origin iframe(s) also detected.';
          this._iframeInfoEl.appendChild(otherEl);
        }
      } else {
        this._iframeInfoEl.textContent = 'No cross-origin iframes detected.';
      }

      // Show portal-specific tip
      if (portalInfo && PORTAL_TIPS[portalInfo.name]) {
        this._tipEl.textContent = 'Tip: ' + PORTAL_TIPS[portalInfo.name];
        this._tipEl.style.display = 'block';
      } else {
        this._tipEl.style.display = 'none';
      }

      this.element.style.display = 'flex';
    }

    hide() {
      if (this.element) {
        this.element.style.display = 'none';
      }
    }

    isVisible() {
      return this.element && this.element.style.display !== 'none';
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.FrameGuide = FrameGuide;
})();
