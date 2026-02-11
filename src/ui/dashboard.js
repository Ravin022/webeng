/**
 * WebEng Dashboard — tab-based navigation wiring all panels together
 */
(function () {
  'use strict';

  class Dashboard {
    constructor(options) {
      this.overlay = options.overlay;
      this.eventBus = options.eventBus;
      this.scannerPanel = options.scannerPanel;
      this.resultsPanel = options.resultsPanel;
      this.networkPanel = options.networkPanel;
      this.settingsPanel = options.settingsPanel;
      this.tabs = [];
      this.activeTab = 0;
    }

    render() {
      var body = this.overlay.getBody();

      // Create tab bar
      var tabBar = document.createElement('div');
      tabBar.className = 'webeng-tabs';

      var tabDefs = [
        { label: 'Scanner', id: 'scanner' },
        { label: 'Results', id: 'results' },
        { label: 'Network', id: 'network' },
        { label: 'Settings', id: 'settings' }
      ];

      var self = this;
      var contentContainer = document.createElement('div');
      contentContainer.style.cssText = 'flex:1;display:flex;flex-direction:column;overflow:hidden;';

      for (var i = 0; i < tabDefs.length; i++) {
        (function (index, def) {
          var tab = document.createElement('div');
          tab.className = 'webeng-tab' + (index === 0 ? ' active' : '');
          tab.textContent = def.label;
          tab.addEventListener('click', function () {
            self._switchTab(index);
          });
          tabBar.appendChild(tab);
          self.tabs.push(tab);
        })(i, tabDefs[i]);
      }

      body.appendChild(tabBar);

      // Render panels
      var scannerEl = this.scannerPanel.render();
      scannerEl.classList.add('active');

      var resultsEl = this.resultsPanel.render();
      var resultsWrapper = document.createElement('div');
      resultsWrapper.className = 'webeng-tab-content';
      resultsWrapper.appendChild(resultsEl);

      var networkEl = this.networkPanel.render();
      var settingsEl = this.settingsPanel.render();

      this.panels = [scannerEl, resultsWrapper, networkEl, settingsEl];

      for (var j = 0; j < this.panels.length; j++) {
        contentContainer.appendChild(this.panels[j]);
      }

      body.appendChild(contentContainer);
    }

    _switchTab(index) {
      // Deactivate all
      for (var i = 0; i < this.tabs.length; i++) {
        this.tabs[i].classList.remove('active');
        this.panels[i].classList.remove('active');
      }
      // Activate selected
      this.tabs[index].classList.add('active');
      this.panels[index].classList.add('active');
      this.activeTab = index;
    }
  }

  window.WebEng = window.WebEng || {};
  window.WebEng.Dashboard = Dashboard;
})();
