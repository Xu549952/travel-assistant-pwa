// ============================================================
// lib/notify.js - Cross-platform Notification Abstraction Layer
// Web: W3C Notification API
// Capacitor: @capacitor/local-notifications (native Android)
// Architecture: IIFE pattern, attaches to window.Notify
// ============================================================
(function () {
  'use strict';

  // Detect Capacitor native platform
  var IS_CAPACITOR = typeof window !== 'undefined' &&
    typeof window.Capacitor !== 'undefined' &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();

  var pendingPermission = null;

  /**
   * Request notification permission
   * @returns {Promise<boolean>} true if granted
   */
  async function requestPermission() {
    if (IS_CAPACITOR) {
      try {
        var LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        var result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      } catch (e) {
        console.warn('Capacitor notification permission failed:', e);
        return false;
      }
    } else {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      var result = await Notification.requestPermission();
      return result === 'granted';
    }
  }

  /**
   * Check if notification permission is granted
   * @returns {boolean}
   */
  function hasPermission() {
    if (IS_CAPACITOR) {
      // Capacitor: assume granted if we've previously requested
      return pendingPermission === 'granted';
    } else {
      return typeof Notification !== 'undefined' && Notification.permission === 'granted';
    }
  }

  /**
   * Generate a numeric ID from a string key
   * @param {string} key - unique key string
   * @returns {number} numeric ID (1-2147483647)
   */
  function idFromKey(key) {
    var hash = 0;
    for (var i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & 0x7FFFFFFF;
    }
    return hash || 1;
  }

  /**
   * Send a notification (immediate or scheduled)
   * @param {string|number} id - unique notification ID
   * @param {string} title - notification title
   * @param {string} body - notification body
   * @param {Date} [scheduleAt] - optional scheduled time
   */
  async function notify(id, title, body, scheduleAt) {
    var numId = typeof id === 'number' ? id : idFromKey(String(id));

    if (IS_CAPACITOR) {
      try {
        var LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        var notif = {
          id: numId,
          title: title,
          body: body,
          smallIcon: 'ic_notification',
          iconColor: '#4B3FE3'
        };
        if (scheduleAt) {
          notif.schedule = { at: scheduleAt };
        }
        await LocalNotifications.schedule({ notifications: [notif] });
      } catch (e) {
        console.warn('Capacitor notify failed:', e);
      }
    } else {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (scheduleAt) {
        var delay = scheduleAt.getTime() - Date.now();
        if (delay > 0) {
          setTimeout(function () {
            new Notification(title, { body: body, tag: String(id) });
          }, delay);
        }
      } else {
        new Notification(title, { body: body, tag: String(id) });
      }
    }
  }

  /**
   * Cancel a scheduled notification
   * @param {string|number} id - notification ID to cancel
   */
  async function cancelNotification(id) {
    var numId = typeof id === 'number' ? id : idFromKey(String(id));

    if (IS_CAPACITOR) {
      try {
        var LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        await LocalNotifications.cancel({ notifications: [{ id: numId }] });
      } catch (e) {
        console.warn('Capacitor cancel failed:', e);
      }
    }
    // Web: setTimeout-based notifications cannot be cancelled after fired
  }

  /**
   * Cancel all pending notifications
   */
  async function cancelAll() {
    if (IS_CAPACITOR) {
      try {
        var LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
        await LocalNotifications.cancel({ notifications: [] });
        // Capacitor 5+: use getPending + cancel
        var pending = await LocalNotifications.getPending();
        if (pending && pending.notifications && pending.notifications.length > 0) {
          var ids = pending.notifications.map(function (n) { return { id: n.id }; });
          await LocalNotifications.cancel({ notifications: ids });
        }
      } catch (e) {
        console.warn('Capacitor cancelAll failed:', e);
      }
    }
  }

  // Expose as window.Notify
  window.Notify = {
    isCapacitor: IS_CAPACITOR,
    requestPermission: requestPermission,
    hasPermission: hasPermission,
    notify: notify,
    cancelNotification: cancelNotification,
    cancelAll: cancelAll,
    _setPermission: function (status) { pendingPermission = status; }
  };
})();
