/**
 * WebEng — Main Entry Point
 * Browser game value modifier engine.
 * Bootstraps all modules and attaches the UI to the page.
 */
(function () {
  'use strict';

  // ===== Idempotency Guard =====
  if (window.__WEBENG__) {
    // Already loaded — toggle visibility
    if (window.__WEBENG__.overlay) {
      window.__WEBENG__.overlay.toggle();
    }
    console.log('[WebEng] Already loaded. Toggled visibility.');
    return;
  }

  console.log('[WebEng] Initializing...');

  // ===== 1. Event Bus =====
  var eventBus = new WebEng.EventBus();

  // ===== 2. Logger =====
  var logger = new WebEng.Logger('info');

  // ===== 3. Bypass Mechanisms (must install early) =====
  var antiTamper = new WebEng.AntiTamper(eventBus);
  // Auto-enable bypasses by default so they catch future game code
  antiTamper.enableAll();
  logger.info('Anti-tamper bypasses enabled.');

  // ===== 4. Core Engine =====
  var objectWalker = new WebEng.ObjectWalker({ maxDepth: 7 });
  var pathResolver = WebEng.PathResolver;
  var scanner = new WebEng.Scanner(objectWalker, pathResolver, eventBus);
  var modifier = new WebEng.Modifier(pathResolver, eventBus);

  // ===== 5. Network Hooks =====
  var hookManager = new WebEng.HookManager(eventBus);
  var xhrHook = new WebEng.XHRHook(hookManager);
  var fetchHook = new WebEng.FetchHook(hookManager);
  var wsHook = new WebEng.WebSocketHook(hookManager);

  xhrHook.install();
  fetchHook.install();
  wsHook.install();
  logger.info('Network hooks installed.');

  // ===== 6. UI =====
  var overlay = new WebEng.Overlay();
  overlay.create();

  var scannerPanel = new WebEng.ScannerPanel(scanner, eventBus);
  var resultsPanel = new WebEng.ResultsPanel(modifier, pathResolver, eventBus);
  var networkPanel = new WebEng.NetworkPanel(hookManager, eventBus);
  var settingsPanel = new WebEng.SettingsPanel(antiTamper, objectWalker, eventBus);

  var dashboard = new WebEng.Dashboard({
    overlay: overlay,
    eventBus: eventBus,
    scannerPanel: scannerPanel,
    resultsPanel: resultsPanel,
    networkPanel: networkPanel,
    settingsPanel: settingsPanel
  });

  dashboard.render();

  // ===== 7. Status Updates =====
  eventBus.on('scan:complete', function (data) {
    overlay.setStatus(data.resultCount + ' result(s) — scan #' + data.scanNumber);
  });

  eventBus.on('scan:reset', function () {
    overlay.setStatus('Ready');
  });

  eventBus.on('value:modified', function (data) {
    overlay.setStatus('Modified: ' + data.path.split('.').pop());
  });

  eventBus.on('value:frozen', function (data) {
    overlay.setStatus('Frozen: ' + data.path.split('.').pop());
  });

  eventBus.on('request:logged', function () {
    // Update status briefly
    overlay.setStatus('Request intercepted');
  });

  eventBus.on('status:update', function (text) {
    overlay.setStatus(text);
  });

  // ===== 8. Register Global Reference =====
  window.__WEBENG__ = {
    overlay: overlay,
    eventBus: eventBus,
    scanner: scanner,
    modifier: modifier,
    hookManager: hookManager,
    antiTamper: antiTamper,
    objectWalker: objectWalker,
    pathResolver: pathResolver,
    logger: logger,

    // Convenience API for console usage
    scan: function (value, type, comparator) {
      return scanner.firstScan(value, type || 'any', comparator || 'exact');
    },
    nextScan: function (value, comparator) {
      return scanner.nextScan(value, comparator || 'exact');
    },
    set: function (path, value) {
      return modifier.setValue(path, value);
    },
    freeze: function (path, value) {
      modifier.freeze(path, value);
    },
    unfreeze: function (path) {
      modifier.unfreeze(path);
    },
    addRule: function (rule) {
      return hookManager.addRule(rule);
    },
    unfreezeObj: function (obj) {
      return antiTamper.unfreezeObject(obj);
    }
  };

  // Also store hookManager on namespace for settings panel
  WebEng._hookManager = hookManager;

  logger.info('WebEng loaded successfully. Press Ctrl+Shift+G to toggle UI.');
  console.log(
    '%c WebEng v1.0 %c Game Value Modifier Engine ',
    'background:#00d4ff;color:#000;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;',
    'background:#1a1a2e;color:#00d4ff;padding:4px 8px;border-radius:0 4px 4px 0;'
  );
  console.log(
    '%cAPI: __WEBENG__.scan(value) | __WEBENG__.set(path, value) | __WEBENG__.freeze(path, value)',
    'color:#888;font-size:11px;'
  );
})();
