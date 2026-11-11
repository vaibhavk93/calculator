import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vaibhavkumawat.vkcalc',
  appName: 'Calc',
  webDir: 'dist',
  // Capacitor's debug logging prints every plugin call and its result to the phone's log. That would put bank message
  // text and senders (SmsQueue.drain, SmsInbox.readRecent) in logcat, so logging is off in every build. Do not remove.
  loggingBehavior: 'none',
};

export default config;
