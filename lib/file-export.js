// ============================================================
// lib/file-export.js - Cross-platform File Export Abstraction
// Web: Blob + <a download> (browser download)
// Capacitor: Filesystem.writeFile to Documents directory
// Architecture: IIFE pattern, attaches to window.FileExport
// ============================================================
(function () {
  'use strict';

  var IS_CAPACITOR = typeof window !== 'undefined' &&
    typeof window.Capacitor !== 'undefined' &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();

  /**
   * Download/export a text file
   * @param {string} filename - file name (e.g., "trip.ics")
   * @param {string} content - file content (text)
   * @param {string} mimeType - MIME type (e.g., "text/calendar")
   * @param {function} [onSuccess] - success callback
   * @param {function} [onError] - error callback
   */
  async function downloadText(filename, content, mimeType, onSuccess, onError) {
    if (IS_CAPACITOR) {
      try {
        var Filesystem = window.Capacitor.Plugins.Filesystem;
        var result = await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: 'DOCUMENTS',
          encoding: 'utf8',
          recursive: true
        });
        if (onSuccess) onSuccess(result.uri);
        else console.log('File saved:', result.uri);
      } catch (e) {
        console.warn('Capacitor file write failed:', e);
        // Fallback to web approach
        _webDownload(filename, content, mimeType);
        if (onError) onError(e);
      }
    } else {
      _webDownload(filename, content, mimeType);
      if (onSuccess) onSuccess(filename);
    }
  }

  /**
   * Download/export a Blob (for binary data like images, audio)
   * @param {string} filename - file name
   * @param {Blob} blob - binary data
   * @param {function} [onSuccess] - success callback
   */
  async function downloadBlob(filename, blob, onSuccess) {
    if (IS_CAPACITOR) {
      try {
        // Convert blob to base64
        var reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async function () {
          var base64Data = reader.result.split(',')[1];
          var Filesystem = window.Capacitor.Plugins.Filesystem;
          var result = await Filesystem.writeFile({
            path: filename,
            data: base64Data,
            directory: 'DOCUMENTS',
            recursive: true
          });
          if (onSuccess) onSuccess(result.uri);
          else console.log('Blob saved:', result.uri);
        };
      } catch (e) {
        console.warn('Capacitor blob write failed:', e);
        _webDownloadBlob(filename, blob);
      }
    } else {
      _webDownloadBlob(filename, blob);
      if (onSuccess) onSuccess(filename);
    }
  }

  // Private: Web download (Blob + <a download>)
  function _webDownload(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType || 'application/octet-stream' });
    _webDownloadBlob(filename, blob);
  }

  function _webDownloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // Expose as window.FileExport
  window.FileExport = {
    isCapacitor: IS_CAPACITOR,
    downloadText: downloadText,
    downloadBlob: downloadBlob
  };
})();
