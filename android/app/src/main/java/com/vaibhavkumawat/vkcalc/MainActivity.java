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
        registerPlugin(SmsQueuePlugin.class);
        // Test-only message injection. The class exists only in the debug and qa builds (src/debug), so release skips this.
        try {
            registerPlugin(Class.forName("com.vaibhavkumawat.vkcalc.SmsDebugPlugin").asSubclass(com.getcapacitor.Plugin.class));
        } catch (ClassNotFoundException ignored) {
            // release build: no hook
        }
        super.onCreate(savedInstanceState);
    }
}
