package com.vaibhavkumawat.vkcalc;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate.
        registerPlugin(BackupFilePlugin.class);
        registerPlugin(SmsInboxPlugin.class);
        registerPlugin(BatterySettingsPlugin.class);
        registerPlugin(ReminderAlarmsPlugin.class);
        registerPlugin(SmsQueuePlugin.class);
        // Test-only message injection. The class exists only in the debug and qa builds (src/debug), so release skips this.
        try {
            registerPlugin(Class.forName("com.vaibhavkumawat.vkcalc.SmsDebugPlugin").asSubclass(com.getcapacitor.Plugin.class));
        } catch (ClassNotFoundException ignored) {
            // release build: no hook
        }
        // Before the notifications plugin starts and silently re-arms lost alarms: count them, so the app can say so (ReminderAlarmsPlugin).
        ReminderAlarmsPlugin.noteLost(this);
        super.onCreate(savedInstanceState);
    }
}
