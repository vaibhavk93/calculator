package com.vaibhavkumawat.vkcalc;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.security.Key;
import java.security.KeyStore;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * AES-256-GCM with a key that lives in the Android Keystore and cannot be exported. A queue file copied off the
 * phone (or read with root) is unreadable without this phone's keystore. Blob layout: 12-byte IV, then ciphertext+tag.
 * If the key is gone (keystore reset), old records fail to decrypt and the store drops them one by one.
 */
final class KeystoreCrypto implements SmsQueueStore.Crypto {
    private static final String ALIAS = "vkcalc_sms_queue_v1";
    private static final String PROVIDER = "AndroidKeyStore";
    private static final int IV_LEN = 12;

    private static SecretKey key(boolean fresh) throws Exception {
        KeyStore ks = KeyStore.getInstance(PROVIDER);
        ks.load(null);
        if (fresh) ks.deleteEntry(ALIAS);
        Key k = ks.getKey(ALIAS, null);
        if (k instanceof SecretKey) return (SecretKey) k;
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER);
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return g.generateKey();
    }

    @Override
    public byte[] encrypt(byte[] plain) throws Exception {
        try {
            return encryptWith(key(false), plain);
        } catch (Exception first) {
            // A key the keystore can no longer use: make a new one once. Old records then fail to decrypt and are dropped.
            return encryptWith(key(true), plain);
        }
    }

    private static byte[] encryptWith(SecretKey k, byte[] plain) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, k);
        byte[] iv = c.getIV();
        byte[] ct = c.doFinal(plain);
        byte[] out = new byte[iv.length + ct.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(ct, 0, out, iv.length, ct.length);
        return out;
    }

    @Override
    public byte[] decrypt(byte[] blob) throws Exception {
        if (blob.length <= IV_LEN) throw new IllegalArgumentException("short blob");
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Arrays.copyOfRange(blob, 0, IV_LEN)));
        return c.doFinal(blob, IV_LEN, blob.length - IV_LEN);
    }
}
