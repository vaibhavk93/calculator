package com.vaibhavkumawat.vkcalc;

import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Helps the user stop the phone maker's battery saver from killing reminders.
 *
 * Needs no permission. It does NOT use REQUEST_IGNORE_BATTERY_OPTIMIZATIONS (Play restricts it): it only opens
 * settings pages. Maker-specific pages are private and differ between phone models and software versions, so every
 * one is tried inside try/catch in order, and the list always ends with the standard battery-optimisation list and
 * then Calc's own App info page. A missing page never crashes: it just falls through to the next.
 */
@CapacitorPlugin(name = "BatterySettings")
public class BatterySettingsPlugin extends Plugin {

    /** The phone maker, lower case ("xiaomi", "oneplus", "samsung"...), plus brand and model for the steps text. */
    @PluginMethod
    public void getManufacturer(PluginCall call) {
        JSObject out = new JSObject();
        out.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase(Locale.ROOT));
        out.put("brand", Build.BRAND == null ? "" : Build.BRAND.toLowerCase(Locale.ROOT));
        out.put("model", Build.MODEL == null ? "" : Build.MODEL);
        call.resolve(out);
    }

    /** Opens the best page for this phone. Resolves { opened: "maker" | "battery" | "app" | "none" }. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        String maker = (Build.MANUFACTURER == null ? "" : Build.MANUFACTURER).toLowerCase(Locale.ROOT);
        String brand = (Build.BRAND == null ? "" : Build.BRAND).toLowerCase(Locale.ROOT);
        String which = "none";

        for (Intent intent : makerIntents(maker + " " + brand)) {
            if (tryStart(intent)) {
                which = "maker";
                break;
            }
        }
        if (which.equals("none") && tryStart(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) which = "battery";
        if (which.equals("none")) {
            Intent app = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
            if (tryStart(app)) which = "app";
        }
        JSObject out = new JSObject();
        out.put("opened", which);
        call.resolve(out);
    }

    /** Starts an activity, returning false (instead of crashing) when it does not exist, is not exported, or is refused. */
    private boolean tryStart(Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static Intent component(String pkg, String cls) {
        Intent i = new Intent();
        i.setComponent(new ComponentName(pkg, cls));
        return i;
    }

    /** Known maker pages, best first. Unknown makers get an empty list. */
    private List<Intent> makerIntents(String who) {
        List<Intent> list = new ArrayList<>();
        if (who.contains("xiaomi") || who.contains("redmi") || who.contains("poco")) {
            // Autostart.
            list.add(component("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
            list.add(new Intent("miui.intent.action.OP_AUTO_START").addCategory(Intent.CATEGORY_DEFAULT));
        } else if (who.contains("oneplus")) {
            list.add(component("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"));
            list.add(component("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
        } else if (who.contains("oppo") || who.contains("realme")) {
            list.add(component("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
            list.add(component("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"));
            list.add(component("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"));
        } else if (who.contains("vivo") || who.contains("iqoo")) {
            list.add(component("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
            list.add(component("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"));
            list.add(component("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"));
        } else if (who.contains("samsung")) {
            // Device care, Battery ("Sleeping apps" lives there).
            list.add(component("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"));
            list.add(component("com.samsung.android.sm_cn", "com.samsung.android.sm.ui.battery.BatteryActivity"));
        } else if (who.contains("huawei") || who.contains("honor")) {
            list.add(component("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
            list.add(component("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"));
        }
        return list;
    }
}
