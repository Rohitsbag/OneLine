/**
 * Notification Service - Daily Journal Reminders
 * Uses Capacitor LocalNotifications for native push notifications
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';

const NOTIFICATION_ID = 1001;

/**
 * Request notification permissions
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
        console.log('Notifications only work on native platforms');
        return false;
    }

    try {
        const permission = await LocalNotifications.requestPermissions();
        return permission.display === 'granted';
    } catch (error) {
        console.error('Failed to request notification permission:', error);
        return false;
    }
}

/**
 * Schedule daily reminder notification
 * @param hour - Hour in 24-hour format (0-23)
 * @param minute - Minute (0-59)
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
        console.log('Notifications only work on native platforms');
        return false;
    }

    try {
        // Cancel any existing scheduled notification first
        await cancelDailyReminder();

        // Create schedule for daily notification
        const now = new Date();
        const scheduledTime = new Date();
        scheduledTime.setHours(hour, minute, 0, 0);

        // If the time has already passed today, schedule for tomorrow
        if (scheduledTime <= now) {
            scheduledTime.setDate(scheduledTime.getDate() + 1);
        }

        const options: ScheduleOptions = {
            notifications: [{
                id: NOTIFICATION_ID,
                title: '📝 OneLine',
                body: 'Take a moment to write your one line for today.',
                schedule: {
                    at: scheduledTime,
                    repeats: true,
                    every: 'day',
                    allowWhileIdle: true,
                },
                sound: 'default',
                smallIcon: 'ic_stat_notification',
                autoCancel: true,
            }],
        };

        await LocalNotifications.schedule(options);
        console.log(`Daily reminder scheduled for ${hour}:${minute.toString().padStart(2, '0')}`);
        return true;
    } catch (error) {
        console.error('Failed to schedule notification:', error);
        return false;
    }
}

/**
 * Cancel the daily reminder notification
 */
export async function cancelDailyReminder(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
        return false;
    }

    try {
        await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
        console.log('Daily reminder cancelled');
        return true;
    } catch (error) {
        console.error('Failed to cancel notification:', error);
        return false;
    }
}

/**
 * Check if notifications are currently scheduled
 */
export async function checkPendingNotifications(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
        return false;
    }

    try {
        const pending = await LocalNotifications.getPending();
        return pending.notifications.some(n => n.id === NOTIFICATION_ID);
    } catch (error) {
        console.error('Failed to check pending notifications:', error);
        return false;
    }
}
