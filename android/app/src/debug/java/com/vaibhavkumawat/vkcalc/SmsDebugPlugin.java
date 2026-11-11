package com.vaibhavkumawat.vkcalc;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Collections;

/**
 * TEST ONLY (src/debug, built into debug and qa, absent from release; MainActivity registers it by name if present).
 * inject({ sender, body, receivedAt? }) -> { queued }: feeds a fake text through SmsReceiver.deliver(), the same
 * function a real incoming text uses. Capture must be on and permission granted, exactly as for a real text.
 */
@CapacitorPlugin(name = "SmsDebug")
public class SmsDebugPlugin extends Plugin {
    @PluginMethod
    public void inject(PluginCall call) {
        String sender = call.getString("sender");
        String body = call.getString("body");
        if (sender == null || body == null) { call.reject("sender and body are required"); return; }
        long at = call.getLong("receivedAt", System.currentTimeMillis());
        JSObject out = new JSObject();
        out.put("queued", SmsReceiver.deliver(getContext(), Collections.singletonList(new SmsReceiver.Part(sender, body, at))));
        call.resolve(out);
    }
}
