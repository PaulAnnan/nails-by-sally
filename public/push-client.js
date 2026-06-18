// push-client.js
// Frontend push notification client for NailsBySally
// Mirrors the structure from Instagram Unfollower Tracker

class PushNotificationClient {
  constructor(apiBase = '/api/push') {
    this.apiBase = apiBase;
    this.swRegistration = null;
    this.isSubscribed = false;
    this.vapidPublicKey = null;
  }

  /**
   * Initialize push notifications
   */
  async init() {
    try {
      // Check if service worker and push are supported
      if (!('serviceWorker' in navigator)) {
        console.log('[Push] Service Worker not supported');
        return false;
      }

      if (!('PushManager' in window)) {
        console.log('[Push] Push API not supported');
        return false;
      }

      // Get service worker registration
      this.swRegistration = await navigator.serviceWorker.ready;
      console.log('[Push] Service Worker ready');

      // Check if already subscribed
      const existingSubscription = await this.swRegistration.pushManager.getSubscription();
      this.isSubscribed = existingSubscription !== null;

      // Get VAPID public key
      await this.fetchVapidPublicKey();

      console.log('[Push] Initialized. Subscribed:', this.isSubscribed);
      return true;
    } catch (error) {
      console.error('[Push] Initialization error:', error);
      return false;
    }
  }

  /**
   * Fetch VAPID public key from server
   */
  async fetchVapidPublicKey() {
    try {
      const response = await fetch(`${this.apiBase}/vapid-public-key`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch VAPID key');
      }

      const data = await response.json();
      this.vapidPublicKey = data.publicKey;
      
      if (!this.vapidPublicKey) {
        throw new Error('No VAPID public key available');
      }

      console.log('[Push] VAPID key fetched');
      return this.vapidPublicKey;
    } catch (error) {
      console.error('[Push] Error fetching VAPID key:', error);
      throw error;
    }
  }

  /**
   * Request notification permission from user
   */
  async requestPermission() {
    try {
      const permission = await Notification.requestPermission();
      console.log('[Push] Permission:', permission);
      return permission;
    } catch (error) {
      console.error('[Push] Permission request error:', error);
      return 'denied';
    }
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe() {
    try {
      if (!this.swRegistration) {
        throw new Error('Service Worker not ready');
      }

      if (!this.vapidPublicKey) {
        await this.fetchVapidPublicKey();
      }

      // Request permission if not granted
      if (Notification.permission !== 'granted') {
        const permission = await this.requestPermission();
        if (permission !== 'granted') {
          throw new Error('Notification permission denied');
        }
      }

      // Check if already subscribed
      let subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
        
        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });

        console.log('[Push] New subscription created');
      } else {
        console.log('[Push] Using existing subscription');
      }

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      this.isSubscribed = true;
      console.log('[Push] Successfully subscribed');
      
      return subscription;
    } catch (error) {
      console.error('[Push] Subscribe error:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe() {
    try {
      if (!this.swRegistration) {
        throw new Error('Service Worker not ready');
      }

      const subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();
        
        // Notify server
        await this.removeSubscriptionFromServer(subscription.endpoint);
        
        console.log('[Push] Successfully unsubscribed');
      }

      this.isSubscribed = false;
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      throw error;
    }
  }

  /**
   * Send subscription to server
   */
  async sendSubscriptionToServer(subscription) {
    try {
      const response = await fetch(`${this.apiBase}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        throw new Error('Failed to send subscription to server');
      }

      console.log('[Push] Subscription sent to server');
      return await response.json();
    } catch (error) {
      console.error('[Push] Error sending subscription:', error);
      throw error;
    }
  }

  /**
   * Remove subscription from server
   */
  async removeSubscriptionFromServer(endpoint) {
    try {
      const response = await fetch(`${this.apiBase}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint })
      });

      if (!response.ok) {
        throw new Error('Failed to remove subscription from server');
      }

      console.log('[Push] Subscription removed from server');
      return await response.json();
    } catch (error) {
      console.error('[Push] Error removing subscription:', error);
      throw error;
    }
  }

  /**
   * Send test notification
   */
  async sendTestNotification() {
    try {
      const response = await fetch(`${this.apiBase}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to send test notification');
      }

      console.log('[Push] Test notification sent');
      return await response.json();
    } catch (error) {
      console.error('[Push] Error sending test notification:', error);
      throw error;
    }
  }

  /**
   * Check subscription status
   */
  async checkSubscription() {
    try {
      if (!this.swRegistration) {
        return false;
      }

      const subscription = await this.swRegistration.pushManager.getSubscription();
      this.isSubscribed = subscription !== null;
      return this.isSubscribed;
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      return false;
    }
  }

  /**
   * Convert VAPID key from base64 to Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  /**
   * Get current subscription
   */
  async getSubscription() {
    try {
      if (!this.swRegistration) {
        return null;
      }
      return await this.swRegistration.pushManager.getSubscription();
    } catch (error) {
      console.error('[Push] Error getting subscription:', error);
      return null;
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PushNotificationClient;
}
