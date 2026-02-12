/**
 * WebEng EngineDetector — detect common game engine patterns
 */
(function () {
  'use strict';

  var ENGINE_SIGNATURES = [
    {
      name: 'Unity WebGL',
      detect: function (w) {
        return !!(w.unityInstance || w.UnityLoader ||
                  w.gameInstance ||
                  (w.Module && w.Module.canvas && w.Module.HEAP32));
      },
      hasWasm: true,
      tips: 'Use WASM scanning (Int32 or Float32). State lives in Module.HEAP32/HEAPF32.'
    },
    {
      name: 'Phaser',
      detect: function (w) {
        return !!(w.Phaser || (w.game && w.game.scene));
      },
      hasWasm: false,
      tips: 'Game state often in game.scene.scenes[0].data or game.registry.'
    },
    {
      name: 'Construct 3',
      detect: function (w) {
        return !!(w.cr_getC2Runtime || w.C3 || w.c3_runtimeInterface);
      },
      hasWasm: true,
      tips: 'Try scanning JS variables. Also supports WASM scanning.'
    },
    {
      name: 'PixiJS',
      detect: function (w) {
        return !!(w.PIXI);
      },
      hasWasm: false,
      tips: 'Game state in application objects, not PIXI itself. Use JS scanning.'
    },
    {
      name: 'Three.js',
      detect: function (w) {
        return !!(w.THREE);
      },
      hasWasm: false,
      tips: 'Look for scene/renderer objects. State may be in userData properties.'
    },
    {
      name: 'Godot',
      detect: function (w) {
        return !!((w.Engine && w.Engine.isWebGLAvailable) || w.Godot);
      },
      hasWasm: true,
      tips: 'Godot uses WASM. Use WASM scanning for game state.'
    },
    {
      name: 'GDevelop',
      detect: function (w) {
        return !!(w.gdjs || w.runtimeScene);
      },
      hasWasm: false,
      tips: 'State in gdjs.RuntimeGame or runtimeScene variables.'
    },
    {
      name: 'Emscripten',
      detect: function (w) {
        return !!(w.Module && (w.Module.HEAP32 || w.Module.wasmMemory));
      },
      hasWasm: true,
      tips: 'WASM memory available via Module.HEAP32/HEAPF32. Use WASM scanning.'
    }
  ];

  var EngineDetector = {
    /**
     * Detect engines in the given window context.
     */
    detect: function (targetWindow) {
      targetWindow = targetWindow || window;
      var found = [];

      for (var i = 0; i < ENGINE_SIGNATURES.length; i++) {
        var sig = ENGINE_SIGNATURES[i];
        try {
          if (sig.detect(targetWindow)) {
            found.push({
              name: sig.name,
              hasWasm: sig.hasWasm,
              tips: sig.tips
            });
          }
        } catch (e) { /* skip */ }
      }
      return found;
    },

    /**
     * Detect engines across main window and all accessible iframes.
     */
    detectAll: function (iframeScanner) {
      var results = [];

      // Check main window
      var mainEngines = this.detect(window);
      for (var i = 0; i < mainEngines.length; i++) {
        mainEngines[i].context = 'window';
        results.push(mainEngines[i]);
      }

      // Check accessible iframes
      if (iframeScanner) {
        var ctxs = iframeScanner.getAccessibleContexts();
        for (var j = 0; j < ctxs.length; j++) {
          try {
            var iframeEngines = this.detect(ctxs[j].contentWindow);
            for (var k = 0; k < iframeEngines.length; k++) {
              iframeEngines[k].context = 'iframe[' + ctxs[j].index + ']';
              results.push(iframeEngines[k]);
            }
          } catch (e) { /* cross-origin, skip */ }
        }
      }

      return results;
    }
  };

  window.WebEng = window.WebEng || {};
  window.WebEng.EngineDetector = EngineDetector;
})();
