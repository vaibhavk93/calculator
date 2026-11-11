package com.vaibhavkumawat.vkcalc;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.capacitorjs.plugins.localnotifications.LocalNotification;
import com.capacitorjs.plugins.localnotifications.LocalNotificationSchedule;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Date;

/**
 * Counts the reminder alarms the phone lost, so the app can say so once (quietly) after putting them back.
 *
 * Why this exists: the notifications plugin keeps its own saved copy of every reminder, and re-arms any copy that has no
 * live alarm each time the app starts (a reboot, a force-stop or a battery saver can wipe the alarms, not the copies).
 * That repair is silent, and it runs before any web code, so the web side can never see that something was lost.
 * MainActivity calls noteLost() just BEFORE the plugin starts, counts the copies that are still ahead in time but have
 * no live alarm, and keeps only that number. The web side reads it once with takeLost().
 *
 * Numbers only: no reminder text is read out, logged or kept. No permission needed.
 */
@CapacitorPlugin(name = "ReminderAlarms")
public class ReminderAlarmsPlugin extends Plugin {

    private static final String PREFS = "vkcalc_reminder_alarms";
    private static final String LOST = "lost";

    /** Call from MainActivity.onCreate before super.onCreate (before the notifications plugin repairs anything). */
    static void noteLost(Context ctx) {
        try {
            int flags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            long now = new Date().getTime();
            int lost = 0;
            for (LocalNotification n : new NotificationStorage(ctx).getSavedNotifications()) {
                LocalNotificationSchedule s = n.getSchedule();
                Integer id = n.getId();
                // Still ahead in time, one-shot, not cancelled, yet no live alarm for it.
                if (id == null || s == null || n.getCancelled() || s.isPerpetual() || s.getAt() == null || s.getAt().getTime() <= now) continue;
                if (PendingIntent.getBroadcast(ctx, id, new Intent(ctx, TimedNotificationPublisher.class), flags) == null) lost++;
            }
            if (lost > 0) {
                SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                p.edit().putInt(LOST, p.getInt(LOST, 0) + lost).apply();
            }
        } catch (Exception ignored) {
            // A count is a nicety. Never let it stop the app from starting.
        }
    }

    /** Resolves { lost: number }: how many alarms were found missing since the last call, then forgets them. */
    @PluginMethod
    public void takeLost(PluginCall call) {
        SharedPreferences p = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int lost = p.getInt(LOST, 0);
        if (lost != 0) p.edit().putInt(LOST, 0).apply();
        JSObject out = new JSObject();
        out.put("lost", lost);
        call.resolve(out);
    }
}
