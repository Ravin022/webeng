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
  antiTamper.enableAll();
  logger.info('Anti-tamper bypasses enabled.');

  // ===== 4. Core Engine =====
  var objectWalker = new WebEng.ObjectWalker({ maxDepth: 10 });
  var pathResolver = WebEng.PathResolver;
  var iframeScanner = new WebEng.IframeScanner(eventBus);
  var wasmScanner = new WebEng.WasmScanner(eventBus);

  var scanner = new WebEng.Scanner(objectWalker, pathResolver, eventBus, {
    iframeScanner: iframeScanner,
    wasmScanner: wasmScanner
  });

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
    iframeScanner: iframeScanner,
    wasmScanner: wasmScanner,
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
    },
    wasmScan: function (value, type) {
      wasmScanner.detectModules(iframeScanner);
      return wasmScanner.firstScan(Number(value), type || 'i32', 0.01, 0);
    },
    detectEngine: function () {
      iframeScanner.detectIframes();
      return WebEng.EngineDetector.detectAll(iframeScanner);
    }
  };

  WebEng._hookManager = hookManager;

  // ===== 9. Auto-detect on load (delayed to let game initialize) =====
  setTimeout(function () {
    try {
      iframeScanner.detectIframes();
      var iframeInfo = iframeScanner.getIframeInfo();

      var engines = WebEng.EngineDetector.detectAll(iframeScanner);
      wasmScanner.detectModules(iframeScanner);

      var statusParts = [];

      if (iframeInfo.length > 0) {
        var accessible = iframeInfo.filter(function (f) { return f.accessible; }).length;
        statusParts.push(iframeInfo.length + ' iframe(s), ' + accessible + ' accessible');
        logger.info('Iframes:', iframeInfo.length, 'total,', accessible, 'accessible');
      }

      if (engines.length > 0) {
        var names = engines.map(function (e) { return e.name; });
        statusParts.push('Engine: ' + names.join(', '));
        logger.info('Detected engines:', names.join(', '));
      }

      if (wasmScanner._modules.length > 0) {
        var heapMB = (wasmScanner._modules[0].heapBuffer.byteLength / 1048576).toFixed(1);
        statusParts.push('WASM: ' + wasmScanner._modules.length + ' module(s), ' + heapMB + 'MB');
        logger.info('WASM modules:', wasmScanner._modules.length);
      }

      if (statusParts.length > 0) {
        eventBus.emit('status:update', statusParts.join(' | '));
      }
    } catch (e) {
      logger.warn('Auto-detection failed:', e.message);
    }
  }, 2000);

  logger.info('WebEng loaded successfully. Press Ctrl+Shift+G to toggle UI.');
  console.log(
    '%c WebEng v1.0 %c Game Value Modifier Engine ',
    'background:#00d4ff;color:#000;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;',
    'background:#1a1a2e;color:#00d4ff;padding:4px 8px;border-radius:0 4px 4px 0;'
  );
  console.log(
    '%cAPI: __WEBENG__.scan(value) | __WEBENG__.set(path, value) | __WEBENG__.freeze(path, value) | __WEBENG__.detectEngine()',
    'color:#888;font-size:11px;'
  );
})();
