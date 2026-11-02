package com.vaibhavkumawat.vkcalc;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves backups to Download/Calc/ through MediaStore (Android 10+, no storage permission needed).
 * Written in Java, not Kotlin: the project has no Kotlin Gradle plugin and this avoids adding one.
 *
 * MediaStore cannot list an empty folder, and an app only sees files it created itself. So
 * hasBackupFolder() means "this app has already saved a backup there", not "the folder exists".
 */
@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {
    private static final String DIR = "Download/Calc/";

    @PluginMethod
    public void hasBackupFolder(PluginCall call) {
        JSObject out = new JSObject();
        boolean found = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try (Cursor c = getContext().getContentResolver().query(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                    new String[] { MediaStore.MediaColumns._ID },
                    MediaStore.MediaColumns.RELATIVE_PATH + "=?",
                    new String[] { DIR },
                    null)) {
                found = c != null && c.moveToFirst();
            } catch (Exception ignored) {
                // Treat a failed query as "not found": the worst case is one extra question.
            }
        }
        out.put("exists", found);
        call.resolve(out);
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        String filename = call.getString("filename");
        String text = call.getString("text");
        if (filename == null || text == null) {
            call.reject("filename and text are required");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Saving to a folder needs Android 10 or newer");
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues v = new ContentValues();
        v.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        v.put(MediaStore.MediaColumns.RELATIVE_PATH, DIR);
        v.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri uri = null;
        try {
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IllegalStateException("The system refused to create the file");
            try (OutputStream os = resolver.openOutputStream(uri)) {
                if (os == null) throw new IllegalStateException("Could not open the file for writing");
                os.write(text.getBytes(StandardCharsets.UTF_8));
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, done, null, null);

            // MediaStore renames a clash to "name (1).json"; report the real name.
            String name = filename;
            try (Cursor c = resolver.query(uri, new String[] { MediaStore.MediaColumns.DISPLAY_NAME }, null, null, null)) {
                if (c != null && c.moveToFirst()) name = c.getString(0);
            } catch (Exception ignored) {
                // keep the requested name
            }
            JSObject out = new JSObject();
            out.put("uri", uri.toString());
            out.put("path", DIR + name);
            call.resolve(out);
        } catch (Exception e) {
            if (uri != null) {
                try {
                    resolver.delete(uri, null, null);
                } catch (Exception ignored) {
                    // nothing more to do
                }
            }
            call.reject(e.getMessage() == null ? "Could not save the backup" : e.getMessage(), e);
        }
    }

    /**
     * Tries, in order: the Calc folder in the system Files app, then the Downloads list. Which one a given phone
     * honours is up to its Files app. The saved file's own URI is not used: that opens the file, not the folder.
     */
    @PluginMethod
    public void openBackupFolder(PluginCall call) {
        Uri folder = DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Download/Calc");
        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setDataAndType(folder, DocumentsContract.Document.MIME_TYPE_DIR);
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        JSObject out = new JSObject();
        try {
            getContext().startActivity(view);
            out.put("opened", "folder");
            call.resolve(out);
            return;
        } catch (ActivityNotFoundException | SecurityException ignored) {
            // fall through to the Downloads list
        }
        try {
            Intent dl = new Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS);
            dl.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(dl);
            out.put("opened", "downloads");
            call.resolve(out);
        } catch (Exception e) {
            call.reject("No app on this phone can open the folder");
        }
    }
}
