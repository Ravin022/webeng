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

  // ===== 1. Context Detection =====
  var context = WebEng.ContextDetector.detectContext();
  var isIframeMode = WebEng.ContextDetector.isIframe();
  var portal = isIframeMode ? null : WebEng.ContextDetector.detectPortal();
  var isGameFrame = WebEng.ContextDetector.looksLikeGameFrame();

  console.log('[WebEng] Context: ' + context +
    (portal ? ' (Portal: ' + portal.name + ')' : '') +
    (isIframeMode ? ' [IFRAME MODE]' : '') +
    (isGameFrame ? ' [Game detected]' : ''));

  // ===== 2. Event Bus =====
  var eventBus = new WebEng.EventBus();

  // ===== 3. Logger =====
  var logger = new WebEng.Logger('info');

  // ===== 4. Bypass Mechanisms (must install early) =====
  var antiTamper = new WebEng.AntiTamper(eventBus);
  antiTamper.enableAll();
  logger.info('Anti-tamper bypasses enabled.');

  // ===== 5. Core Engine =====
  var objectWalker = new WebEng.ObjectWalker({ maxDepth: 10 });
  var pathResolver = WebEng.PathResolver;
  var iframeScanner = new WebEng.IframeScanner(eventBus);
  var wasmScanner = new WebEng.WasmScanner(eventBus);

  var scanner = new WebEng.Scanner(objectWalker, pathResolver, eventBus, {
    iframeScanner: iframeScanner,
    wasmScanner: wasmScanner
  });

  // In iframe mode, disable iframe sub-scanning by default
  if (isIframeMode) {
    scanner.scanIframes = false;
  }

  var modifier = new WebEng.Modifier(pathResolver, eventBus);

  // ===== 6. Network Hooks =====
  var hookManager = new WebEng.HookManager(eventBus);
  var xhrHook = new WebEng.XHRHook(hookManager);
  var fetchHook = new WebEng.FetchHook(hookManager);
  var wsHook = new WebEng.WebSocketHook(hookManager);

  xhrHook.install();
  fetchHook.install();
  wsHook.install();
  logger.info('Network hooks installed.');

  // ===== 7. UI =====
  var overlay = new WebEng.Overlay();
  overlay.create();

  // Set iframe mode on overlay (badge + adaptive sizing)
  if (isIframeMode) {
    overlay.setIframeMode(true);
  }

  var scannerPanel = new WebEng.ScannerPanel(scanner, eventBus);
  var resultsPanel = new WebEng.ResultsPanel(modifier, pathResolver, eventBus);
  var networkPanel = new WebEng.NetworkPanel(hookManager, eventBus);
  var settingsPanel = new WebEng.SettingsPanel(antiTamper, objectWalker, eventBus);

  // Create frame guide only when NOT in iframe mode (parent page needs it)
  var frameGuide = null;
  if (!isIframeMode && WebEng.FrameGuide) {
    frameGuide = new WebEng.FrameGuide(eventBus);
  }

  var dashboard = new WebEng.Dashboard({
    overlay: overlay,
    eventBus: eventBus,
    scannerPanel: scannerPanel,
    resultsPanel: resultsPanel,
    networkPanel: networkPanel,
    settingsPanel: settingsPanel,
    frameGuide: frameGuide
  });

  dashboard.render();

  // ===== 8. Status Updates =====
  var _lastMeaningfulStatus = 'Ready';

  eventBus.on('scan:complete', function (data) {
    _lastMeaningfulStatus = data.resultCount + ' result(s) — scan #' + data.scanNumber;
    overlay.setStatus(_lastMeaningfulStatus);
  });

  eventBus.on('scan:reset', function () {
    _lastMeaningfulStatus = 'Ready';
    overlay.setStatus(_lastMeaningfulStatus);
  });

  eventBus.on('value:modified', function (data) {
    _lastMeaningfulStatus = 'Modified: ' + data.path.split('.').pop();
    overlay.setStatus(_lastMeaningfulStatus);
  });

  eventBus.on('value:frozen', function (data) {
    _lastMeaningfulStatus = 'Frozen: ' + data.path.split('.').pop();
    overlay.setStatus(_lastMeaningfulStatus);
  });

  // Debounced network request status — don't flood the status bar
  var _requestCount = 0;
  var _requestDebounce = null;
  eventBus.on('request:logged', function () {
    _requestCount++;
    if (!_requestDebounce) {
      _requestDebounce = setTimeout(function () {
        // Only show if no more important status is pending
        if (_requestCount > 0) {
          overlay.setStatus(_requestCount + ' request(s) intercepted');
          _requestCount = 0;
          // Revert to meaningful status after a brief display
          setTimeout(function () {
            overlay.setStatus(_lastMeaningfulStatus);
          }, 2000);
        }
        _requestDebounce = null;
      }, 3000);
    }
  });

  eventBus.on('status:update', function (text) {
    _lastMeaningfulStatus = text;
    overlay.setStatus(text);
  });

  // Bridge status updates
  eventBus.on('bridge:connected', function (data) {
    overlay.setStatus('Bridge connected (' + data.peerRole + ')');
    logger.info('PostMessage bridge connected to', data.peerRole);
  });

  eventBus.on('bridge:status', function (data) {
    overlay.setStatus('[Bridge] ' + data.text);
  });

  // ===== 9. Register Global Reference =====
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
    context: context,
    isIframeMode: isIframeMode,
    bridge: null,

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
      wasmScanner.detectModules(isIframeMode ? null : iframeScanner);
      return wasmScanner.firstScan(Number(value), type || 'i32', 0.01, 0);
    },
    detectEngine: function () {
      if (isIframeMode) {
        return WebEng.EngineDetector.detect(window);
      }
      iframeScanner.detectIframes();
      return WebEng.EngineDetector.detectAll(iframeScanner);
    }
  };

  WebEng._hookManager = hookManager;

  // ===== 10. Auto-detect on load (delayed to let game initialize) =====
  setTimeout(function () {
    try {
      if (isIframeMode) {
        // IFRAME MODE: detect engines + WASM on current window only
        var statusParts = ['IFRAME MODE'];

        var engines = WebEng.EngineDetector.detect(window);
        wasmScanner.detectModules(null); // no iframe scanner needed

        if (isGameFrame) {
          statusParts.push('Game frame detected');
        }

        if (engines.length > 0) {
          var engineNames = engines.map(function (e) { return e.name; });
          statusParts.push('Engine: ' + engineNames.join(', '));
          logger.info('Detected engines:', engineNames.join(', '));
        }

        if (wasmScanner._modules.length > 0) {
          var heapMB = (wasmScanner._modules[0].heapBuffer.byteLength / 1048576).toFixed(1);
          statusParts.push('WASM: ' + wasmScanner._modules.length + ' module(s), ' + heapMB + 'MB');
          logger.info('WASM modules:', wasmScanner._modules.length);
        }

        eventBus.emit('status:update', statusParts.join(' | '));

        // Set up bridge in iframe mode
        if (WebEng.PostMessageBridge) {
          var bridge = new WebEng.PostMessageBridge(eventBus, 'iframe');
          bridge.start();
          window.__WEBENG__.bridge = bridge;
          logger.info('PostMessage bridge started (iframe role)');
        }
      } else {
        // PARENT/TOP MODE: run full detection
        iframeScanner.detectIframes();
        var iframeInfo = iframeScanner.getIframeInfo();

        var engines2 = WebEng.EngineDetector.detectAll(iframeScanner);
        wasmScanner.detectModules(iframeScanner);

        var statusParts2 = [];

        if (iframeInfo.length > 0) {
          var accessible = iframeInfo.filter(function (f) { return f.accessible; }).length;
          statusParts2.push(iframeInfo.length + ' iframe(s), ' + accessible + ' accessible');
          logger.info('Iframes:', iframeInfo.length, 'total,', accessible, 'accessible');
        }

        if (engines2.length > 0) {
          var names = engines2.map(function (e) { return e.name; });
          statusParts2.push('Engine: ' + names.join(', '));
          logger.info('Detected engines:', names.join(', '));
        }

        if (wasmScanner._modules.length > 0) {
          var heapMB2 = (wasmScanner._modules[0].heapBuffer.byteLength / 1048576).toFixed(1);
          statusParts2.push('WASM: ' + wasmScanner._modules.length + ' module(s), ' + heapMB2 + 'MB');
          logger.info('WASM modules:', wasmScanner._modules.length);
        }

        // Check for cross-origin iframes — this triggers the frame guide
        var crossOriginIframes = iframeScanner.getCrossOriginInfo();
        if (crossOriginIframes.length > 0) {
          statusParts2.push(crossOriginIframes.length + ' cross-origin');
          logger.info('Cross-origin iframes:', crossOriginIframes.length,
            '- Game may be in:', crossOriginIframes[0].src);
        }

        if (statusParts2.length > 0) {
          eventBus.emit('status:update', statusParts2.join(' | '));
        }

        // Set up bridge in parent mode
        if (WebEng.PostMessageBridge) {
          var bridge2 = new WebEng.PostMessageBridge(eventBus, 'parent');
          bridge2.start();
          window.__WEBENG__.bridge = bridge2;
          logger.info('PostMessage bridge started (parent role)');
        }
      }
    } catch (e) {
      logger.warn('Auto-detection failed:', e.message);
    }
  }, 2000);

  logger.info('WebEng loaded successfully. Press Ctrl+Shift+G to toggle UI.');
  console.log(
    '%c WebEng v1.0 %c Game Value Modifier Engine ' +
    (isIframeMode ? '%c IFRAME MODE ' : ''),
    'background:#00d4ff;color:#000;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;',
    'background:#1a1a2e;color:#00d4ff;padding:4px 8px;' +
    (isIframeMode ? 'border-radius:0;' : 'border-radius:0 4px 4px 0;'),
    isIframeMode ? 'background:#22aa44;color:#fff;font-weight:bold;padding:4px 8px;border-radius:0 4px 4px 0;' : ''
  );
  console.log(
    '%cAPI: __WEBENG__.scan(value) | __WEBENG__.set(path, value) | __WEBENG__.freeze(path, value) | __WEBENG__.detectEngine()',
    'color:#888;font-size:11px;'
  );
  if (isIframeMode) {
    console.log(
      '%cRunning in IFRAME MODE — scanning current frame directly.',
      'color:#22aa44;font-size:11px;font-weight:bold;'
    );
  }
})();
