package com.vaibhavkumawat.vkcalc;

import static org.junit.Assert.*;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/** The queue rules (docs/SMS-CAPTURE.md): cap, expiry, dedupe, atomic write, bad record, zero logging, sender filter. */
public class SmsQueueStoreTest {
    private static final long DAY = 86_400_000L;
    private static final long NOW = 1_800_000_000_000L;

    @Rule public TemporaryFolder tmp = new TemporaryFolder();

    /** Same AES-256-GCM, IV||ciphertext layout as KeystoreCrypto, with an ordinary key (a JVM has no Android Keystore). */
    static class TestCrypto implements SmsQueueStore.Crypto {
        final SecretKey key;
        boolean failEncrypt = false;
        TestCrypto(SecretKey key) { this.key = key; }
        @Override public byte[] encrypt(byte[] plain) throws Exception {
            if (failEncrypt) throw new IllegalStateException("boom");
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = c.getIV(), ct = c.doFinal(plain), out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return out;
        }
        @Override public byte[] decrypt(byte[] blob) throws Exception {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Arrays.copyOfRange(blob, 0, 12)));
            return c.doFinal(blob, 12, blob.length - 12);
        }
    }

    private File file;
    private TestCrypto crypto;
    private final AtomicLong clock = new AtomicLong(NOW);
    private SmsQueueStore store;

    @Before public void setUp() throws Exception {
        file = new File(tmp.getRoot(), "q.bin");
        KeyGenerator g = KeyGenerator.getInstance("AES");
        g.init(256);
        crypto = new TestCrypto(g.generateKey());
        store = new SmsQueueStore(file, crypto, clock::get);
    }

    private static List<String> bodies(List<SmsQueueStore.Msg> l) {
        List<String> out = new ArrayList<>();
        for (SmsQueueStore.Msg m : l) out.add(m.body);
        return out;
    }

    @Test public void queuesAndDrainsOldestFirstWithoutDeleting() throws Exception {
        assertTrue(store.add("HDFCBK", "second", NOW - 1000, 0));
        assertTrue(store.add("HDFCBK", "first", NOW - 2000, 0));
        assertEquals(Arrays.asList("first", "second"), bodies(store.drain()));
        assertEquals("drain must not delete", 2, store.drain().size());
        SmsQueueStore.Msg m = store.drain().get(0);
        assertEquals("HDFCBK", m.sender);
        assertEquals(NOW - 2000, m.receivedAt);
    }

    @Test public void sameMessageIsNeverQueuedTwice() throws Exception {
        assertTrue(store.add("HDFCBK", "Rs 100 debited", NOW - 5, 0));
        assertFalse(store.add("HDFCBK", "Rs 100 debited", NOW - 5, 0));
        assertEquals(1, store.size());
        // a different time, index, sender or body is a different message
        assertTrue(store.add("HDFCBK", "Rs 100 debited", NOW - 4, 0));
        assertTrue(store.add("HDFCBK", "Rs 100 debited", NOW - 5, 1));
        assertTrue(store.add("ICICIB", "Rs 100 debited", NOW - 5, 0));
        assertEquals(4, store.size());
        assertEquals(SmsQueueStore.idFor("A", "b", 1, 0), SmsQueueStore.idFor("A", "b", 1, 0));
    }

    @Test public void duplicateIsStillRejectedAfterARestart() throws Exception {
        store.add("HDFCBK", "x", NOW - 5, 0);
        SmsQueueStore again = new SmsQueueStore(file, crypto, clock::get);
        assertFalse(again.add("HDFCBK", "x", NOW - 5, 0));
        assertEquals(1, again.size());
    }

    @Test public void capsAtFiveHundredDroppingTheOldest() throws Exception {
        for (int i = 0; i < SmsQueueStore.MAX + 20; i++) store.add("HDFCBK", "m" + i, NOW - 100_000 + i, 0);
        List<SmsQueueStore.Msg> all = store.drain();
        assertEquals(SmsQueueStore.MAX, all.size());
        assertEquals("m20", all.get(0).body);
        assertEquals("m519", all.get(all.size() - 1).body);
    }

    @Test public void dropsMessagesOlderThanThirtyDays() throws Exception {
        store.add("HDFCBK", "old", NOW - 29 * DAY, 0);
        store.add("HDFCBK", "new", NOW - 1000, 0);
        assertEquals(2, store.size());
        clock.set(NOW + 2 * DAY); // "old" is now 31 days old
        assertEquals(Collections.singletonList("new"), bodies(store.drain()));
        assertFalse("an already-expired message is not queued", store.add("HDFCBK", "ancient", NOW - 40 * DAY, 0));
    }

    @Test public void ackDeletesOnlyTheGivenIdsAndIgnoresUnknownOnes() throws Exception {
        store.add("HDFCBK", "a", NOW - 3, 0);
        store.add("HDFCBK", "b", NOW - 2, 0);
        store.add("HDFCBK", "c", NOW - 1, 0);
        String idB = store.drain().get(1).id;
        store.ack(Arrays.asList(idB, "no-such-id"));
        assertEquals(Arrays.asList("a", "c"), bodies(store.drain()));
        store.clear();
        assertEquals(0, store.size());
    }

    @Test public void survivesRestartAndTheFileHoldsNoPlainText() throws Exception {
        store.add("HDFCBK", "Rs 4,999.00 debited at SECRETSHOP", NOW - 5, 0);
        SmsQueueStore again = new SmsQueueStore(file, crypto, clock::get);
        assertEquals(1, again.size());
        String raw = new String(Files.readAllBytes(file.toPath()), StandardCharsets.ISO_8859_1);
        assertFalse(raw.contains("SECRETSHOP"));
        assertFalse(raw.contains("HDFCBK"));
        assertFalse(raw.contains("4,999"));
    }

    @Test public void aFailedWriteLeavesTheOldFileIntact() throws Exception {
        store.add("HDFCBK", "keep me", NOW - 5, 0);
        byte[] before = Files.readAllBytes(file.toPath());
        crypto.failEncrypt = true;
        try { store.add("HDFCBK", "lost?", NOW - 4, 0); fail("expected a failure"); } catch (IOException expected) { /* ok */ }
        assertArrayEquals("the queue file must not change when a write fails", before, Files.readAllBytes(file.toPath()));
        crypto.failEncrypt = false;
        assertEquals(Collections.singletonList("keep me"), bodies(store.drain()));
    }

    @Test public void aLeftoverTempFileFromACrashIsIgnoredAndReplaced() throws Exception {
        store.add("HDFCBK", "one", NOW - 5, 0);
        Files.write(new File(file.getPath() + ".tmp").toPath(), new byte[] { 1, 2, 3, 4, 5 }); // a half-written temp from a crash
        assertEquals(Collections.singletonList("one"), bodies(store.drain()));
        assertTrue(store.add("HDFCBK", "two", NOW - 4, 0));
        assertEquals(Arrays.asList("one", "two"), bodies(store.drain()));
        assertFalse(new File(file.getPath() + ".tmp").exists());
    }

    @Test public void anUndecryptableRecordIsDroppedAndTheRestSurvive() throws Exception {
        store.add("HDFCBK", "good one", NOW - 5, 0);
        // a second store with a DIFFERENT key appends a record the first key cannot read
        KeyGenerator g = KeyGenerator.getInstance("AES");
        g.init(256);
        SmsQueueStore other = new SmsQueueStore(file, new TestCrypto(g.generateKey()), clock::get);
        other.add("HDFCBK", "other key", NOW - 4, 0); // other.load() drops "good one" (wrong key for it) and keeps only its own
        store.add("HDFCBK", "good two", NOW - 3, 0);   // store.load() drops "other key", keeps nothing else, adds this
        assertEquals(Collections.singletonList("good two"), bodies(store.drain()));
    }

    @Test public void aDamagedFileKeepsWhatCanBeReadAndNeverThrows() throws Exception {
        store.add("HDFCBK", "a", NOW - 3, 0);
        store.add("HDFCBK", "b", NOW - 2, 0);
        byte[] bytes = Files.readAllBytes(file.toPath());
        Files.write(file.toPath(), Arrays.copyOf(bytes, bytes.length - 10)); // cut the last record short
        assertEquals(Collections.singletonList("a"), bodies(store.drain()));
        Files.write(file.toPath(), new byte[] { 9, 9, 9 });                  // total garbage
        assertEquals(0, store.drain().size());
        assertTrue(store.add("HDFCBK", "fresh", NOW - 1, 0));
    }

    @Test public void twoThreadsAddingAtOnceLoseNothing() throws Exception {
        Thread[] ts = new Thread[4];
        for (int t = 0; t < ts.length; t++) {
            final int base = t * 25;
            ts[t] = new Thread(() -> {
                try { for (int i = 0; i < 25; i++) store.add("HDFCBK", "t" + (base + i), NOW - 1000 + base + i, 0); } catch (IOException e) { throw new RuntimeException(e); }
            });
            ts[t].start();
        }
        for (Thread t : ts) t.join();
        assertEquals(100, store.size());
    }

    // ---- sender filter and multipart join (the receiver's pure part) ----

    @Test public void onlyLetterStyleSendersAreKeptAndPhoneNumbersAreDropped() {
        for (String ok : new String[] { "HDFCBK", "VM-ICICIB", "AX-SBIUPI", "JX-HDFCBK-S", "Paytm" }) assertTrue(ok, SmsInboxPlugin.isBankSender(ok));
        for (String no : new String[] { "+919876543210", "9876543210", "09876543210", "12345", "", null, "a b", "+91-HDFC" }) assertFalse(String.valueOf(no), SmsInboxPlugin.isBankSender(no));
        List<SmsReceiver.Part> in = Arrays.asList(
            new SmsReceiver.Part("+919876543210", "hi it is me", NOW),
            new SmsReceiver.Part("HDFCBK", "Rs 1 debited", NOW));
        List<SmsReceiver.Part> out = SmsReceiver.collapse(in);
        assertEquals(1, out.size());
        assertEquals("HDFCBK", out.get(0).sender);
    }

    @Test public void multipartPiecesFromOneSenderAreJoinedInOrder() {
        List<SmsReceiver.Part> out = SmsReceiver.collapse(Arrays.asList(
            new SmsReceiver.Part("HDFCBK", "Rs 100 deb", NOW - 2),
            new SmsReceiver.Part("ICICIB", "other", NOW - 1),
            new SmsReceiver.Part("HDFCBK", "ited at X", NOW)));
        assertEquals(2, out.size());
        assertEquals("Rs 100 debited at X", out.get(0).body);
        assertEquals(NOW - 2, out.get(0).at);
        assertEquals("other", out.get(1).body);
    }

    // ---- zero logging ----

    /** No capture class may log, print, or print a stack trace: message text and senders must never reach logcat. */
    @Test public void captureCodeNeverLogs() throws Exception {
        String[] names = { "SmsReceiver", "SmsQueueStore", "SmsCapture", "KeystoreCrypto", "SmsQueuePlugin" };
        String[] banned = { "Log.", "android.util.Log", "System.out", "System.err", "printStackTrace", "Timber", "Logger", "println" };
        List<File> files = new ArrayList<>();
        for (String n : names) files.add(new File("src/main/java/com/vaibhavkumawat/vkcalc/" + n + ".java"));
        files.add(new File("src/debug/java/com/vaibhavkumawat/vkcalc/SmsDebugReceiver.java"));
        files.add(new File("src/debug/java/com/vaibhavkumawat/vkcalc/SmsDebugPlugin.java"));
        for (File f : files) {
            assertTrue("test must run from the module folder, missing " + f, f.exists());
            String src = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
            // comments may mention these words; check code only
            String code = src.replaceAll("(?s)/\\*.*?\\*/", "").replaceAll("//[^\n]*", "");
            for (String b : banned) assertFalse(f.getName() + " contains " + b, code.contains(b));
        }
    }

    @Test public void releaseBuildHasNoTestInjectionHook() throws Exception {
        // the hook lives only under src/debug; nothing in src/main may name it except MainActivity's by-name lookup
        for (File f : new File("src/main/java/com/vaibhavkumawat/vkcalc").listFiles()) {
            if (f.getName().equals("MainActivity.java")) continue;
            String src = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
            assertFalse(f.getName(), src.contains("SmsDebug"));
        }
        assertFalse(new String(Files.readAllBytes(new File("src/main/AndroidManifest.xml").toPath()), StandardCharsets.UTF_8).contains("SmsDebug"));
    }
}
