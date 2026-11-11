package com.vaibhavkumawat.vkcalc;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

/**
 * The app's side of the capture queue (src/lib/smsQueue.ts, SmsQueuePort). The receiver fills the queue while the
 * app is closed; this plugin lets the app read it (drain), delete what it saved (ack) and switch capture on or off.
 * Nothing here logs, and drain() never deletes: only ack() and clear() do.
 */
@CapacitorPlugin(
    name = "SmsQueue",
    permissions = { @Permission(strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }, alias = "capture") }
)
public class SmsQueuePlugin extends Plugin {

    @Override
    public void load() {
        // Keep the receiver's enabled state in line with the saved choice (an update or restore can reset it).
        try { SmsCapture.applyComponent(getContext()); } catch (Exception ignored) { /* retried on the next toggle */ }
    }

    /** { state: "granted" | "denied" | "prompt" }. "prompt" until we have asked once; after that, not granted = "denied". */
    @PluginMethod
    public void permission(PluginCall call) {
        Context c = getContext();
        String state = SmsCapture.hasPermission(c) ? "granted" : SmsCapture.asked(c) ? "denied" : "prompt";
        JSObject out = new JSObject();
        out.put("state", state);
        call.resolve(out);
    }

    /** Shows Android's dialog for both permissions. Resolves { granted }. On a restricted or blocked phone it returns denied at once. */
    @PluginMethod
    public void request(PluginCall call) {
        if (SmsCapture.hasPermission(getContext())) {
            JSObject out = new JSObject();
            out.put("granted", true);
            call.resolve(out);
            return;
        }
        SmsCapture.markAsked(getContext());
        requestPermissionForAlias("capture", call, "afterRequest");
    }

    @PermissionCallback
    private void afterRequest(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", SmsCapture.hasPermission(getContext()));
        call.resolve(out);
    }

    /** { enabled }: the user's switch is on, the receiver is enabled, and the permission is granted. */
    @PluginMethod
    public void captureEnabled(PluginCall call) {
        Context c = getContext();
        JSObject out = new JSObject();
        out.put("enabled", SmsCapture.isOn(c) && SmsCapture.componentEnabled(c) && SmsCapture.hasPermission(c));
        call.resolve(out);
    }

    @PluginMethod
    public void setCaptureEnabled(PluginCall call) {
        Boolean on = call.getBoolean("on");
        if (on == null) { call.reject("on is required"); return; }
        try {
            SmsCapture.setOn(getContext(), on);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not change message capture");
        }
    }

    @PluginMethod
    public void drain(PluginCall call) {
        try {
            JSArray rows = new JSArray();
            for (SmsQueueStore.Msg m : SmsCapture.store(getContext()).drain()) {
                JSObject row = new JSObject();
                row.put("id", m.id);
                row.put("sender", m.sender);
                row.put("body", m.body);
                row.put("receivedAt", m.receivedAt);
                rows.put(row);
            }
            JSObject out = new JSObject();
            out.put("messages", rows);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not read the waiting messages");
        }
    }

    @PluginMethod
    public void ack(PluginCall call) {
        try {
            JSArray arr = call.getArray("ids");
            List<String> ids = new ArrayList<>();
            if (arr != null) for (int i = 0; i < arr.length(); i++) ids.add(arr.getString(i));
            SmsCapture.store(getContext()).ack(ids);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not remove the saved messages");
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        SmsCapture.store(getContext()).clear();
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings");
        }
    }
}
