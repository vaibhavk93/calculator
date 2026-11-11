package com.vaibhavkumawat.vkcalc;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Catches incoming text messages while the app is closed and queues the bank-style ones (docs/SMS-CAPTURE.md).
 *
 * Rules:
 *  - Does nothing unless the user turned capture on AND the SMS permission is granted.
 *  - Only letter-style senders (the same rule as the manual scan, SmsInboxPlugin.isBankSender). Texts from phone
 *    numbers, which are people, are dropped here and never read further or kept.
 *  - Every other message from a letter-style sender is queued; the app's parser decides what is money.
 *  - NEVER logs: no Log.*, no printing, and no exception text, because a message or sender must not reach logcat.
 *  - Never throws out of onReceive.
 *  - No goAsync(): the work is one small file write, done before onReceive returns.
 *
 * Messages that arrive between a restart and the first unlock are not delivered to apps by Android. The manual
 * scan still finds them.
 */
public class SmsReceiver extends BroadcastReceiver {
    /** One piece of an incoming text, before multipart pieces are joined. */
    static final class Part {
        final String sender, body;
        final long at;
        Part(String sender, String body, long at) { this.sender = sender; this.body = body; this.at = at; }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            if (intent == null || !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
            SmsMessage[] raw = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (raw == null) return;
            List<Part> parts = new ArrayList<>();
            for (SmsMessage m : raw) {
                if (m == null || m.getOriginatingAddress() == null || m.getMessageBody() == null) continue;
                parts.add(new Part(m.getOriginatingAddress(), m.getMessageBody(), m.getTimestampMillis()));
            }
            deliver(context, parts);
        } catch (Throwable ignored) {
            // A failure here must never crash the phone's SMS delivery, and must not be logged (it could hold content).
        }
    }

    /** The one code path for a received message. The debug-only injection hook calls this too. Returns how many were queued. */
    static int deliver(Context context, List<Part> parts) {
        try {
            if (!SmsCapture.isOn(context) || !SmsCapture.hasPermission(context)) return 0;
            List<Part> messages = collapse(parts);
            SmsQueueStore store = SmsCapture.store(context);
            int queued = 0;
            for (int i = 0; i < messages.size(); i++) {
                Part p = messages.get(i);
                try {
                    if (store.add(p.sender, p.body, p.at, i)) queued++;
                } catch (Exception ignored) {
                    // one message failing to save must not stop the others
                }
            }
            return queued;
        } catch (Throwable t) {
            return 0;
        }
    }

    /** Joins pieces from the same sender into one message and drops senders that are not letter-style. Order is kept. */
    static List<Part> collapse(List<Part> parts) {
        Map<String, StringBuilder> bodies = new LinkedHashMap<>();
        Map<String, Long> times = new LinkedHashMap<>();
        for (Part p : parts) {
            if (!SmsInboxPlugin.isBankSender(p.sender)) continue;
            StringBuilder sb = bodies.get(p.sender);
            if (sb == null) { bodies.put(p.sender, sb = new StringBuilder()); times.put(p.sender, p.at); }
            sb.append(p.body);
        }
        List<Part> out = new ArrayList<>();
        for (Map.Entry<String, StringBuilder> e : bodies.entrySet()) {
            out.add(new Part(e.getKey(), e.getValue().toString(), times.get(e.getKey())));
        }
        return out;
    }
}
