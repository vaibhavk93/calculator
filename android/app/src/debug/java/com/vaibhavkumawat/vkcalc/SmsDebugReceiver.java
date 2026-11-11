package com.vaibhavkumawat.vkcalc;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.util.Collections;

/**
 * TEST ONLY (src/debug, built into debug and qa, absent from release). Drive it from a computer:
 *   adb shell am broadcast -n <package>/com.vaibhavkumawat.vkcalc.SmsDebugReceiver --es op inject \
 *       --es sender HDFCBK --es body "text" --el at 1700000000000
 *   ... --es op count      prints the queue size and ids (the result line "data=...")
 * "inject" goes through SmsReceiver.deliver(), the same function a real incoming text uses, so the on/off switch, the
 * permission check, the sender filter and the queue all apply. It works with the app closed (it starts the process).
 * It never logs: results come back through the broadcast result, not logcat.
 */
public class SmsDebugReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String result;
        try {
            String op = intent.getStringExtra("op");
            if ("inject".equals(op)) {
                long at = intent.getLongExtra("at", System.currentTimeMillis());
                int n = SmsReceiver.deliver(context, Collections.singletonList(
                    new SmsReceiver.Part(intent.getStringExtra("sender"), intent.getStringExtra("body"), at)));
                result = "queued=" + n;
            } else if ("count".equals(op)) {
                StringBuilder ids = new StringBuilder();
                java.util.List<SmsQueueStore.Msg> all = SmsCapture.store(context).drain();
                for (SmsQueueStore.Msg m : all) ids.append(m.id).append(',');
                result = "size=" + all.size() + " ids=" + ids;
            } else {
                result = "unknown op";
            }
        } catch (Throwable t) {
            result = "error";
        }
        setResultData(result);
    }
}
