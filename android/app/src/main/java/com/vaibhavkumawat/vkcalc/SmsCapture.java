package com.vaibhavkumawat.vkcalc;

import android.Manifest;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import java.io.File;

/** Shared by the receiver and the plugin: the on/off flag, the permission check, and the one queue instance. */
final class SmsCapture {
    private static final String PREFS = "vkcalc_sms_capture";
    private static final String KEY_ON = "on";
    private static final String KEY_ASKED = "asked";
    private static SmsQueueStore store;

    private SmsCapture() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** The user's choice. Off by default: capture only starts after the user turns it on in the app. */
    static boolean isOn(Context c) {
        return prefs(c).getBoolean(KEY_ON, false);
    }

    static void setOn(Context c, boolean on) {
        prefs(c).edit().putBoolean(KEY_ON, on).commit();
        applyComponent(c);
    }

    /** Off means the system stops delivering SMS_RECEIVED to us at all, not just that we ignore it. */
    static void applyComponent(Context c) {
        c.getPackageManager().setComponentEnabledSetting(
            new ComponentName(c, SmsReceiver.class),
            isOn(c) ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP);
    }

    static boolean componentEnabled(Context c) {
        return c.getPackageManager().getComponentEnabledSetting(new ComponentName(c, SmsReceiver.class))
            == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
    }

    /** Both permissions, so the receiver and the plugin can never disagree about "allowed". */
    static boolean hasPermission(Context c) {
        return ContextCompat.checkSelfPermission(c, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(c, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean asked(Context c) {
        return prefs(c).getBoolean(KEY_ASKED, false);
    }

    static void markAsked(Context c) {
        prefs(c).edit().putBoolean(KEY_ASKED, true).commit();
    }

    /** app-private, and in the no-backup folder so it is never part of a device transfer or cloud backup. */
    static synchronized SmsQueueStore store(Context c) {
        if (store == null) {
            store = new SmsQueueStore(new File(c.getApplicationContext().getNoBackupFilesDir(), "sms-queue.bin"),
                new KeystoreCrypto(), System::currentTimeMillis);
        }
        return store;
    }
}
