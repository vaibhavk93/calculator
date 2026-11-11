package com.vaibhavkumawat.vkcalc;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.LongSupplier;

/**
 * The phone-side queue of captured bank messages (docs/SMS-CAPTURE.md).
 *
 * One file, one encrypted record per message. Plain Java (no Android classes) so it runs in JVM unit tests;
 * the Android Keystore key arrives through {@link Crypto}.
 *
 * Rules kept here:
 *  - At most MAX messages and MAX_AGE_MS old (by receivedAt). Oldest are dropped first.
 *  - The same message (sender|body|receivedAt|index) is never queued twice: the id is a hash of those four.
 *  - Every write goes to a temp file, is synced, then renamed over the real file. A crash leaves the old file intact.
 *  - A record that cannot be decrypted is dropped on its own; the rest survive.
 *  - Thread-safe (one lock). The receiver and the plugin can run at the same time.
 *  - Nothing here logs, and no exception text contains message content.
 */
final class SmsQueueStore {
    interface Crypto {
        byte[] encrypt(byte[] plain) throws Exception;
        byte[] decrypt(byte[] blob) throws Exception;
    }

    static final class Msg {
        final String id, sender, body;
        final long receivedAt;
        private final byte[] blob; // the encrypted record, kept so a rewrite does not re-encrypt everything

        Msg(String id, String sender, String body, long receivedAt, byte[] blob) {
            this.id = id; this.sender = sender; this.body = body; this.receivedAt = receivedAt; this.blob = blob;
        }
    }

    static final int MAX = 500;
    static final long MAX_AGE_MS = 30L * 24 * 60 * 60 * 1000;
    private static final int VERSION = 1;
    private static final int MAX_BLOB = 1 << 20; // a longer record means a damaged file, not a message

    private final File file;
    private final Crypto crypto;
    private final LongSupplier clock;

    SmsQueueStore(File file, Crypto crypto, LongSupplier clock) {
        this.file = file; this.crypto = crypto; this.clock = clock;
    }

    /** Stable id: the same message always gets the same id, so a repeated delivery cannot be queued twice. */
    static String idFor(String sender, String body, long receivedAt, int index) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256")
                .digest((sender + "|" + body + "|" + receivedAt + "|" + index).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 16; i++) sb.append(String.format("%02x", h[i]));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 missing");
        }
    }

    /** Returns true when the message is now in the queue as a new entry, false for a duplicate or an expired message. */
    synchronized boolean add(String sender, String body, long receivedAt, int index) throws IOException {
        List<Msg> list = load();
        String id = idFor(sender, body, receivedAt, index);
        for (Msg m : list) if (m.id.equals(id)) return false;
        byte[] blob;
        try {
            blob = crypto.encrypt(serialize(id, sender, body, receivedAt));
        } catch (Exception e) {
            throw new IOException("encrypt failed");
        }
        int at = list.size();
        while (at > 0 && list.get(at - 1).receivedAt > receivedAt) at--; // keep oldest first
        list.add(at, new Msg(id, sender, body, receivedAt, blob));
        prune(list);
        write(list);
        for (Msg m : list) if (m.id.equals(id)) return true;
        return false;
    }

    /** Everything waiting, oldest first. Deletes nothing. */
    synchronized List<Msg> drain() throws IOException {
        return load();
    }

    synchronized void ack(Collection<String> ids) throws IOException {
        Set<String> gone = new HashSet<>(ids);
        List<Msg> list = load();
        int before = list.size();
        list.removeIf(m -> gone.contains(m.id));
        if (list.size() != before) write(list);
    }

    synchronized void clear() {
        file.delete();
        new File(file.getPath() + ".tmp").delete();
    }

    synchronized int size() throws IOException {
        return load().size();
    }

    // ponytail: every operation decrypts the whole file (at most MAX records, one keystore call each). Fine for a
    // queue that is nearly always empty or short; if it ever hurts, keep a cache or put receivedAt in the clear.
    private List<Msg> load() throws IOException {
        List<Msg> list = new ArrayList<>();
        boolean dirty = false;
        if (file.exists()) {
            try (DataInputStream in = new DataInputStream(new BufferedInputStream(new FileInputStream(file)))) {
                if (in.readInt() != VERSION) throw new IOException("unknown version");
                int n = in.readInt();
                for (int i = 0; i < n; i++) {
                    int len = in.readInt();
                    if (len < 0 || len > MAX_BLOB) { dirty = true; break; }
                    byte[] blob = new byte[len];
                    in.readFully(blob);
                    Msg m = parse(blob);
                    if (m == null) dirty = true; else list.add(m);
                }
            } catch (IOException e) {
                dirty = true; // truncated or unreadable: keep what was read
            }
        }
        if (prune(list)) dirty = true;
        if (dirty) {
            try { write(list); } catch (IOException ignored) { /* the next write tries again */ }
        }
        return list;
    }

    private Msg parse(byte[] blob) {
        try {
            DataInputStream in = new DataInputStream(new ByteArrayInputStream(crypto.decrypt(blob)));
            String id = readString(in), sender = readString(in), body = readString(in);
            return new Msg(id, sender, body, in.readLong(), blob);
        } catch (Exception e) {
            return null; // this record only
        }
    }

    /** Drops expired entries, then the oldest beyond MAX. Returns whether anything was removed. */
    private boolean prune(List<Msg> list) {
        long now = clock.getAsLong();
        boolean changed = list.removeIf(m -> now - m.receivedAt > MAX_AGE_MS);
        while (list.size() > MAX) { list.remove(0); changed = true; }
        return changed;
    }

    private void write(List<Msg> list) throws IOException {
        File tmp = new File(file.getPath() + ".tmp");
        try (FileOutputStream fos = new FileOutputStream(tmp);
             DataOutputStream out = new DataOutputStream(new BufferedOutputStream(fos))) {
            out.writeInt(VERSION);
            out.writeInt(list.size());
            for (Msg m : list) {
                out.writeInt(m.blob.length);
                out.write(m.blob);
            }
            out.flush();
            fos.getFD().sync();
        } catch (IOException e) {
            tmp.delete();
            throw e;
        }
        if (!tmp.renameTo(file)) { // atomic on the phone's file system: the old file stays whole until this succeeds
            tmp.delete();
            throw new IOException("could not replace the queue file");
        }
    }

    private static byte[] serialize(String id, String sender, String body, long receivedAt) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        DataOutputStream out = new DataOutputStream(bos);
        writeString(out, id); writeString(out, sender); writeString(out, body);
        out.writeLong(receivedAt);
        return bos.toByteArray();
    }

    private static void writeString(DataOutputStream out, String s) throws IOException {
        byte[] b = s.getBytes(StandardCharsets.UTF_8);
        out.writeInt(b.length);
        out.write(b);
    }

    private static String readString(DataInputStream in) throws IOException {
        int n = in.readInt();
        if (n < 0 || n > MAX_BLOB) throw new IOException("bad length");
        byte[] b = new byte[n];
        in.readFully(b);
        return new String(b, StandardCharsets.UTF_8);
    }
}
