package com.vaibhavkumawat.vkcalc;

import android.Manifest;
import android.database.Cursor;
import android.net.Uri;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.regex.Pattern;

/**
 * Reads bank-style text messages on demand, only when the user taps "Scan messages" in Budget.
 *
 * Privacy rules enforced here, not just in the app:
 *  - This class never reads in the background: the inbox is read once per tap. (Catching new messages while the app is
 *    closed is a separate, opt-in path: SmsReceiver and SmsQueuePlugin. It uses isBankSender() below.)
 *  - Only messages whose sender is an ALPHANUMERIC header (HDFCBK, VM-ICICIB, AX-SBIUPI...) leave this class.
 *    Messages from ordinary phone numbers (people) are never read into the app.
 *  - Only the last N days, at most MAX rows. Nothing is stored or logged here.
 */
@CapacitorPlugin(
    name = "SmsInbox",
    permissions = { @Permission(strings = { Manifest.permission.READ_SMS }, alias = "sms") }
)
public class SmsInboxPlugin extends Plugin {
    private static final int MAX = 1500;
    // A sender header: letters/digits, at least one letter, optionally prefixed "XX-" and suffixed "-S" / "-T" / "-P" / "-G"
    // (JX-HDFCBK-S is how Indian banks appear). Phone numbers are digits and "+" only.
    private static final Pattern HEADER = Pattern.compile("^(?:[A-Za-z0-9]{2}-)?[A-Za-z0-9]{3,11}(?:-[A-Za-z0-9]{1,2})?$");
    private static final Pattern HAS_LETTER = Pattern.compile(".*[A-Za-z].*");

    /** The one sender rule, shared with the capture receiver (SmsReceiver): letter-style headers only, never phone numbers. */
    static boolean isBankSender(String address) {
        return address != null && HEADER.matcher(address).matches() && HAS_LETTER.matcher(address).matches();
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(out);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            JSObject out = new JSObject();
            out.put("granted", true);
            call.resolve(out);
            return;
        }
        requestPermissionForAlias("sms", call, "afterPermission");
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        JSObject out = new JSObject();
        out.put("granted", getPermissionState("sms") == PermissionState.GRANTED);
        call.resolve(out);
    }

    @PluginMethod
    public void readRecent(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            call.reject("Permission to read messages was not given.");
            return;
        }
        int days = call.getInt("days", 30);
        if (days < 1) days = 1;
        if (days > 400) days = 400;
        long since = System.currentTimeMillis() - days * 86_400_000L;
        JSArray rows = new JSArray();
        try (Cursor c = getContext().getContentResolver().query(
                Uri.parse("content://sms/inbox"),
                new String[] { "_id", "address", "date", "body" },
                "date >= ?",
                new String[] { String.valueOf(since) },
                "date DESC")) {
            if (c != null) {
                while (c.moveToNext() && rows.length() < MAX) {
                    String address = c.getString(1);
                    if (!isBankSender(address)) continue;
                    JSObject row = new JSObject();
                    row.put("id", c.getString(0));
                    row.put("address", address);
                    row.put("date", c.getLong(2));
                    row.put("body", c.getString(3));
                    rows.put(row);
                }
            }
        } catch (Exception e) {
            call.reject("Could not read messages.");
            return;
        }
        JSObject out = new JSObject();
        out.put("messages", rows);
        call.resolve(out);
    }
}
