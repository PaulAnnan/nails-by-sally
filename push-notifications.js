// push-notifications.js
// NailsBySally appointment notification helper module
// Mirrors the structure from Instagram Unfollower Tracker

import webpush from 'web-push';

/**
 * Build notification payload for different appointment events
 */
export function buildNotificationPayload(type, data) {
  const basePayload = {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: '/appointments.html',
      timestamp: Date.now()
    }
  };

  switch (type) {
    case 'new_booking':
      return {
        ...basePayload,
        title: '💅 New Appointment Booked',
        body: `${data.clientName} booked ${data.serviceName} for ${data.date} at ${data.time}`,
        tag: 'new-appointment',
        data: {
          ...basePayload.data,
          appointmentId: data.appointmentId,
          type: 'new_booking'
        }
      };

    case 'booking_confirmation':
      return {
        ...basePayload,
        title: '✨ Appointment Confirmed',
        body: `Your ${data.serviceName} appointment is confirmed for ${data.date} at ${data.time}`,
        tag: 'booking-confirmation',
        data: {
          ...basePayload.data,
          appointmentId: data.appointmentId,
          type: 'booking_confirmation'
        }
      };

    case 'reminder_24h':
      return {
        ...basePayload,
        title: '⏰ Appointment Reminder',
        body: `Reminder: ${data.serviceName} tomorrow at ${data.time}`,
        tag: 'reminder-24h',
        requireInteraction: true,
        data: {
          ...basePayload.data,
          appointmentId: data.appointmentId,
          type: 'reminder_24h'
        }
      };

    case 'reminder_1h':
      return {
        ...basePayload,
        title: '🚨 Appointment Starting Soon',
        body: `Your ${data.serviceName} appointment starts in 1 hour`,
        tag: 'reminder-1h',
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        data: {
          ...basePayload.data,
          appointmentId: data.appointmentId,
          type: 'reminder_1h'
        }
      };

    case 'payment_received':
      return {
        ...basePayload,
        title: '💰 Payment Received',
        body: `Deposit of $${data.amount} received for ${data.serviceName}`,
        tag: 'payment-received',
        data: {
          ...basePayload.data,
          appointmentId: data.appointmentId,
          type: 'payment_received'
        }
      };

    case 'cancellation':
      return {
        ...basePayload,
        title: '❌ Appointment Cancelled',
        body: `${data.clientName}'s ${data.serviceName} on ${data.date} has been cancelled`,
        tag: 'cancellation',
        data: {
          ...basePayload.data,
          appointmentId: data.appointmentId,
          type: 'cancellation'
        }
      };

    case 'reschedule':
      return {
        ...basePayload,
        title: '📅 Appointment Rescheduled',
        body: `${data.clientName}'s appointment moved to ${data.newDate} at ${data.newTime}`,
        tag: 'reschedule',
        data: {
          ...basePayload.data,
          appointmentId: data.appointmentId,
          type: 'reschedule'
        }
      };

    case 'status_update':
      return {
        ...basePayload,
        title: '📋 Appointment Status Updated',
        body: `${data.clientName}'s appointment status: ${data.status}`,
        tag: 'status-update',
        data: {
          ...basePayload.data,
          appointmentId: data.appointmentId,
          type: 'status_update'
        }
      };

    case 'test':
      return {
        ...basePayload,
        title: '🧪 Test Notification',
        body: 'This is a test notification from Nails By Sally',
        tag: 'test-notification',
        data: {
          ...basePayload.data,
          type: 'test'
        }
      };

    default:
      return {
        ...basePayload,
        title: 'Nails By Sally',
        body: 'You have a new notification',
        tag: 'default-notification',
        data: {
          ...basePayload.data,
          type: 'default'
        }
      };
  }
}

/**
 * Send push notification to a single subscription
 */
export async function sendPushToSubscription(subscription, payload) {
  try {
    const notificationPayload = JSON.stringify(payload);
    await webpush.sendNotification(subscription, notificationPayload);
    return { success: true };
  } catch (error) {
    console.error('[Push] Send error:', error.message);
    
    // Return error info for cleanup
    if (error.statusCode === 404 || error.statusCode === 410) {
      return { success: false, expired: true, endpoint: subscription.endpoint };
    }
    
    return { success: false, expired: false, error: error.message };
  }
}

/**
 * Send push notification to all subscriptions
 */
export async function sendPushToAll(subscriptionsMap, payload) {
  const results = {
    sent: 0,
    failed: 0,
    expired: []
  };

  const promises = [];

  for (const [endpoint, subscription] of subscriptionsMap) {
    promises.push(
      sendPushToSubscription(subscription, payload)
        .then(result => {
          if (result.success) {
            results.sent++;
          } else {
            results.failed++;
            if (result.expired) {
              results.expired.push(endpoint);
            }
          }
        })
    );
  }

  await Promise.allSettled(promises);

  // Clean up expired subscriptions
  results.expired.forEach(endpoint => {
    subscriptionsMap.delete(endpoint);
  });

  return results;
}

/**
 * Schedule appointment reminders
 * (This would typically be used with a job scheduler like node-cron)
 */
export function shouldSendReminder(appointment, reminderType = '24h') {
  const now = new Date();
  const appointmentTime = new Date(appointment.startAt);
  const timeDiff = appointmentTime - now;
  
  // Convert to hours
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  if (reminderType === '24h') {
    // Send 24-hour reminder between 23-25 hours before
    return hoursDiff >= 23 && hoursDiff <= 25;
  } else if (reminderType === '1h') {
    // Send 1-hour reminder between 55-65 minutes before
    const minutesDiff = timeDiff / (1000 * 60);
    return minutesDiff >= 55 && minutesDiff <= 65;
  }
  
  return false;
}

export default {
  buildNotificationPayload,
  sendPushToSubscription,
  sendPushToAll,
  shouldSendReminder
};
