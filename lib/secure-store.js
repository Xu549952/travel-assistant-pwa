// ============================================================
// lib/secure-store.js - Cross-platform Secure Storage Abstraction
// Web: localStorage (architectural limitation, accepted)
// Capacitor: capacitor-secure-storage-plugin (Android Keystore)
// Architecture: IIFE pattern, attaches to window.SecureStore
// ============================================================
(function () {
  'use strict';

  // Detect Capacitor native platform
  var IS_CAPACITOR = typeof window !== 'undefined' &&
    typeof window.Capacitor !== 'undefined' &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();

  /**
   * Store a value securely
   * @param {string} key - storage key
   * @param {string} value - value to store
   */
  async function set(key, value) {
    if (IS_CAPACITOR) {
      try {
        var SecureStoragePlugin = window.Capacitor.Plugins.SecureStoragePlugin;
        await SecureStoragePlugin.set({ key: key, value: String(value) });
      } catch (e) {
        console.warn('SecureStore set failed, falling back to localStorage:', e);
        localStorage.setItem(key, value);
      }
    } else {
      localStorage.setItem(key, value);
    }
  }

  /**
   * Retrieve a value from secure storage
   * @param {string} key - storage key
   * @returns {Promise<string|null>} stored value or null
   */
  async function get(key) {
    if (IS_CAPACITOR) {
      try {
        var SecureStoragePlugin = window.Capacitor.Plugins.SecureStoragePlugin;
        var result = await SecureStoragePlugin.get({ key: key });
        return result.value;
      } catch (e) {
        // Key not found or error - fall back to localStorage
        return localStorage.getItem(key);
      }
    } else {
      return localStorage.getItem(key);
    }
  }

  /**
   * Remove a value from secure storage
   * @param {string} key - storage key
   */
  async function remove(key) {
    if (IS_CAPACITOR) {
      try {
        var SecureStoragePlugin = window.Capacitor.Plugins.SecureStoragePlugin;
        await SecureStoragePlugin.remove({ key: key });
      } catch (e) {
        localStorage.removeItem(key);
      }
    } else {
      localStorage.removeItem(key);
    }
  }

  /**
   * Synchronous get (for backward compatibility with localStorage)
   * Falls back to localStorage in all cases
   * @param {string} key
   * @returns {string|null}
   */
  function getSync(key) {
    return localStorage.getItem(key);
  }

  /**
   * Synchronous set (for backward compatibility with localStorage)
   * @param {string} key
   * @param {string} value
   */
  function setSync(key, value) {
    localStorage.setItem(key, value);
    // Also push to secure storage asynchronously if in Capacitor
    if (IS_CAPACITOR) {
      set(key, value).catch(function () {});
    }
  }

  /**
   * Synchronous remove (for backward compatibility with localStorage)
   * @param {string} key
   */
  function removeSync(key) {
    localStorage.removeItem(key);
    if (IS_CAPACITOR) {
      remove(key).catch(function () {});
    }
  }

  // Expose as window.SecureStore
  window.SecureStore = {
    isCapacitor: IS_CAPACITOR,
    set: set,
    get: get,
    remove: remove,
    getSync: getSync,
    setSync: setSync,
    removeSync: removeSync
  };
})();
