/**
 * WebEng Styles — all CSS as a JS string for Shadow DOM injection
 */
(function () {
  'use strict';

  var STYLES = `
    :host {
      all: initial;
      font-family: 'Segoe UI', -apple-system, sans-serif;
      font-size: 13px;
      color: #e0e0e0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* ===== Main Container ===== */
    .webeng-panel {
      width: 480px;
      height: 560px;
      background: rgba(18, 18, 28, 0.96);
      border: 1px solid #3a3a5c;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      resize: both;
      min-width: 360px;
      min-height: 300px;
    }

    .webeng-panel.minimized {
      height: auto !important;
      min-height: auto;
      resize: none;
    }

    .webeng-panel.minimized .webeng-body {
      display: none;
    }

    /* ===== Title Bar ===== */
    .webeng-titlebar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      cursor: move;
      user-select: none;
      border-bottom: 1px solid #3a3a5c;
      flex-shrink: 0;
    }

    .webeng-title {
      font-size: 14px;
      font-weight: 600;
      color: #00d4ff;
      letter-spacing: 1px;
    }

    .webeng-title-buttons {
      display: flex;
      gap: 6px;
    }

    .webeng-title-btn {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: #aaa;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }

    .webeng-title-btn:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }

    /* ===== Tab Bar ===== */
    .webeng-tabs {
      display: flex;
      background: #0f0f1a;
      border-bottom: 1px solid #3a3a5c;
      flex-shrink: 0;
    }

    .webeng-tab {
      flex: 1;
      padding: 8px 4px;
      text-align: center;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: #888;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      user-select: none;
    }

    .webeng-tab:hover {
      color: #ccc;
      background: rgba(255, 255, 255, 0.03);
    }

    .webeng-tab.active {
      color: #00d4ff;
      border-bottom-color: #00d4ff;
    }

    /* ===== Body / Content ===== */
    .webeng-body {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .webeng-tab-content {
      display: none;
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      flex-direction: column;
    }

    .webeng-tab-content.active {
      display: flex;
    }

    /* ===== Form Controls ===== */
    .webeng-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      align-items: center;
    }

    .webeng-label {
      font-size: 11px;
      color: #888;
      margin-bottom: 4px;
      display: block;
    }

    .webeng-input {
      background: #1a1a2e;
      border: 1px solid #3a3a5c;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 6px 8px;
      font-size: 13px;
      font-family: 'Consolas', 'Monaco', monospace;
      outline: none;
      transition: border-color 0.2s;
    }

    .webeng-input:focus {
      border-color: #00d4ff;
    }

    .webeng-input::placeholder {
      color: #555;
    }

    .webeng-select {
      background: #1a1a2e;
      border: 1px solid #3a3a5c;
      border-radius: 4px;
      color: #e0e0e0;
      padding: 6px 8px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }

    .webeng-select:focus {
      border-color: #00d4ff;
    }

    .webeng-btn {
      background: linear-gradient(135deg, #0066cc, #0044aa);
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .webeng-btn:hover {
      background: linear-gradient(135deg, #0077ee, #0055cc);
    }

    .webeng-btn:active {
      transform: scale(0.97);
    }

    .webeng-btn.danger {
      background: linear-gradient(135deg, #cc3333, #aa2222);
    }

    .webeng-btn.danger:hover {
      background: linear-gradient(135deg, #dd4444, #bb3333);
    }

    .webeng-btn.success {
      background: linear-gradient(135deg, #22aa44, #118833);
    }

    .webeng-btn.success:hover {
      background: linear-gradient(135deg, #33bb55, #229944);
    }

    .webeng-btn.secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #ccc;
    }

    .webeng-btn.secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .webeng-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .webeng-btn.small {
      padding: 3px 8px;
      font-size: 11px;
    }

    /* ===== Results Table ===== */
    .webeng-results-container {
      flex: 1;
      overflow-y: auto;
      border: 1px solid #2a2a3c;
      border-radius: 4px;
      background: #0d0d18;
    }

    .webeng-results-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .webeng-results-table th {
      background: #1a1a2e;
      padding: 6px 8px;
      text-align: left;
      font-weight: 600;
      color: #aaa;
      border-bottom: 1px solid #3a3a5c;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .webeng-results-table td {
      padding: 4px 8px;
      border-bottom: 1px solid #1a1a2e;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .webeng-results-table tr:hover td {
      background: rgba(0, 212, 255, 0.05);
    }

    .webeng-results-actions {
      display: flex;
      gap: 4px;
    }

    /* ===== Status Bar ===== */
    .webeng-status {
      padding: 4px 12px;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #2a2a3c;
      background: #0a0a14;
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
    }

    .webeng-status .count {
      color: #00d4ff;
    }

    /* ===== Network Panel ===== */
    .webeng-network-subtabs {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
    }

    .webeng-network-subtab {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 3px;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.05);
      color: #888;
      border: none;
    }

    .webeng-network-subtab.active {
      background: rgba(0, 212, 255, 0.15);
      color: #00d4ff;
    }

    .webeng-log-entry {
      padding: 6px 8px;
      border-bottom: 1px solid #1a1a2e;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .webeng-log-entry:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .webeng-log-entry .method {
      color: #ff9800;
      font-weight: 600;
      margin-right: 8px;
    }

    .webeng-log-entry .url {
      color: #aaa;
      word-break: break-all;
    }

    .webeng-log-entry .status-ok {
      color: #4caf50;
    }

    .webeng-log-entry .status-err {
      color: #f44336;
    }

    .webeng-log-entry .ws-in {
      color: #4caf50;
    }

    .webeng-log-entry .ws-out {
      color: #ff9800;
    }

    .webeng-log-detail {
      display: none;
      padding: 8px;
      background: #0a0a14;
      border: 1px solid #2a2a3c;
      border-radius: 4px;
      margin: 4px 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 200px;
      overflow-y: auto;
      color: #ccc;
    }

    .webeng-log-detail.expanded {
      display: block;
    }

    /* ===== Rules ===== */
    .webeng-rule {
      padding: 8px;
      border: 1px solid #2a2a3c;
      border-radius: 4px;
      margin-bottom: 6px;
      background: #0f0f1a;
    }

    .webeng-rule-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .webeng-rule-name {
      font-weight: 600;
      color: #00d4ff;
    }

    /* ===== Settings ===== */
    .webeng-setting-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #1a1a2e;
    }

    .webeng-setting-label {
      font-size: 13px;
    }

    .webeng-setting-desc {
      font-size: 11px;
      color: #666;
      margin-top: 2px;
    }

    /* Toggle Switch */
    .webeng-toggle {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }

    .webeng-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .webeng-toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #333;
      border-radius: 22px;
      transition: 0.3s;
    }

    .webeng-toggle-slider:before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: #999;
      border-radius: 50%;
      transition: 0.3s;
    }

    .webeng-toggle input:checked + .webeng-toggle-slider {
      background: #0066cc;
    }

    .webeng-toggle input:checked + .webeng-toggle-slider:before {
      transform: translateX(18px);
      background: #fff;
    }

    /* Range slider */
    .webeng-range {
      -webkit-appearance: none;
      appearance: none;
      width: 120px;
      height: 4px;
      background: #333;
      border-radius: 2px;
      outline: none;
    }

    .webeng-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      background: #00d4ff;
      border-radius: 50%;
      cursor: pointer;
    }

    /* ===== Scrollbar ===== */
    ::-webkit-scrollbar {
      width: 6px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #555;
    }

    /* ===== Bookmarks ===== */
    .webeng-bookmarks {
      margin-top: 8px;
      border-top: 1px solid #2a2a3c;
      padding-top: 8px;
    }

    .webeng-bookmarks-title {
      font-size: 11px;
      color: #888;
      margin-bottom: 6px;
      font-weight: 600;
    }

    .webeng-bookmark-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 11px;
      font-family: 'Consolas', 'Monaco', monospace;
    }

    .webeng-bookmark-path {
      color: #aaa;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }

    .webeng-bookmark-value {
      color: #00d4ff;
      margin: 0 8px;
    }

    /* ===== Inline Edit ===== */
    .webeng-inline-edit {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .webeng-inline-edit input {
      width: 80px;
      padding: 2px 4px;
      font-size: 11px;
      font-family: 'Consolas', 'Monaco', monospace;
      background: #1a1a2e;
      border: 1px solid #00d4ff;
      color: #e0e0e0;
      border-radius: 3px;
      outline: none;
    }

    /* ===== Empty state ===== */
    .webeng-empty {
      text-align: center;
      padding: 30px;
      color: #555;
      font-size: 13px;
    }

    /* ===== Frame Guide ===== */
    .webeng-frame-guide {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
    }

    .webeng-frame-guide-banner {
      background: linear-gradient(135deg, #ff6b00, #cc4400);
      color: #fff;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }

    .webeng-frame-guide-step {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #1a1a2e;
      font-size: 12px;
      color: #ccc;
      align-items: flex-start;
    }

    .webeng-frame-guide-num {
      background: #00d4ff;
      color: #000;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      flex-shrink: 0;
    }

    .webeng-frame-guide-url {
      background: #0d0d18;
      border: 1px solid #3a3a5c;
      border-radius: 4px;
      padding: 8px 10px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 11px;
      color: #00d4ff;
      word-break: break-all;
    }

    .webeng-frame-guide-tip {
      font-size: 11px;
      color: #888;
      font-style: italic;
      margin-top: 4px;
    }

    /* ===== Iframe Mode Badge ===== */
    .webeng-iframe-badge {
      background: #22aa44;
      color: #fff;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      margin-left: 8px;
    }

    /* ===== Animations ===== */
    @keyframes webeng-fadein {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .webeng-panel {
      animation: webeng-fadein 0.2s ease-out;
    }
  `;

  window.WebEng = window.WebEng || {};
  window.WebEng.STYLES = STYLES;
})();
