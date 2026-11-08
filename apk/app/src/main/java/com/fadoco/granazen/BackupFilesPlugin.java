package com.fadoco.granazen;

import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "BackupFiles")
public class BackupFilesPlugin extends Plugin {
    private static final int MAX_BACKUP_BYTES = 20 * 1024 * 1024;
    private final Map<String, FinancialReportSession> financialReportSessions = new ConcurrentHashMap<>();

    private static final class FinancialReportSession {
        private final Uri uri;
        private final OutputStream output;
        private int bytesWritten;

        private FinancialReportSession(Uri uri, OutputStream output) {
            this.uri = uri;
            this.output = output;
        }
    }

    @PluginMethod
    public void saveBackup(PluginCall call) {
        String content = call.getString("content");
        String fileName = call.getString("fileName");
        if (content == null || fileName == null || !fileName.matches("granazen-backup-[0-9-]+\\.json")) {
            call.reject("Os dados ou o nome do arquivo de backup são inválidos.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveBackupResult");
    }

    @PluginMethod
    public void beginFinancialReport(PluginCall call) {
        String fileName = call.getString("fileName");
        if (fileName == null || !fileName.matches("granazen-relatorio-financeiro-[0-9-]+\\.json")) {
            call.reject("O nome do relatório financeiro é inválido.");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "beginFinancialReportResult");
    }

    @ActivityCallback
    private void beginFinancialReportResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("status", "cancelled");
            call.resolve(cancelled);
            return;
        }

        Uri uri = data.getData();
        try {
            OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w");
            if (output == null) throw new IllegalStateException("Não foi possível abrir o arquivo escolhido.");
            String sessionId = UUID.randomUUID().toString();
            financialReportSessions.put(sessionId, new FinancialReportSession(uri, output));
            JSObject selected = new JSObject();
            selected.put("status", "selected");
            selected.put("sessionId", sessionId);
            call.resolve(selected);
        } catch (Exception exception) {
            deleteDocument(uri);
            call.reject("Não foi possível preparar o arquivo do relatório.", exception);
        }
    }

    @PluginMethod
    public void writeFinancialReportChunk(PluginCall call) {
        String sessionId = call.getString("sessionId");
        String content = call.getString("content");
        boolean finish = Boolean.TRUE.equals(call.getBoolean("finish", false));
        FinancialReportSession session = sessionId == null ? null : financialReportSessions.get(sessionId);
        if (session == null || content == null) {
            call.reject("A sessão de gravação do relatório não está disponível.");
            return;
        }

        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        try {
            synchronized (session) {
                if (session.bytesWritten + bytes.length > MAX_BACKUP_BYTES) {
                    throw new IllegalStateException("O relatório excede o limite de 20 MB.");
                }
                session.output.write(bytes);
                session.bytesWritten += bytes.length;
                if (finish) {
                    session.output.flush();
                    session.output.close();
                    financialReportSessions.remove(sessionId, session);
                }
            }
            JSObject result = new JSObject();
            result.put("status", finish ? "saved" : "writing");
            call.resolve(result);
        } catch (Exception exception) {
            discardFinancialReport(sessionId, session);
            call.reject("Não foi possível concluir o relatório financeiro. O arquivo incompleto foi removido quando possível.", exception);
        }
    }

    @PluginMethod
    public void cancelFinancialReport(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId != null) {
            FinancialReportSession session = financialReportSessions.get(sessionId);
            if (session != null) discardFinancialReport(sessionId, session);
        }
        call.resolve();
    }

    private void discardFinancialReport(String sessionId, FinancialReportSession session) {
        if (!financialReportSessions.remove(sessionId, session)) return;
        synchronized (session) {
            try {
                session.output.close();
            } catch (Exception ignored) {
            }
            deleteDocument(session.uri);
        }
    }

    private void deleteDocument(Uri uri) {
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), uri);
        } catch (Exception ignored) {
        }
    }

    @ActivityCallback
    private void saveBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("status", "cancelled");
            call.resolve(cancelled);
            return;
        }

        String content = call.getString("content");
        if (content == null || content.getBytes(StandardCharsets.UTF_8).length > MAX_BACKUP_BYTES) {
            call.reject("O arquivo de backup excede o tamanho permitido.");
            return;
        }

        try (OutputStream output = getContext().getContentResolver().openOutputStream(data.getData(), "w")) {
            if (output == null) throw new IllegalStateException("Não foi possível abrir o arquivo escolhido.");
            output.write(content.getBytes(StandardCharsets.UTF_8));
            output.flush();
            JSObject saved = new JSObject();
            saved.put("status", "saved");
            call.resolve(saved);
        } catch (Exception exception) {
            call.reject("Não foi possível salvar o arquivo de backup.", exception);
        }
    }

    @PluginMethod
    public void pickBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
            "application/json",
            "text/json",
            "text/plain",
            "application/octet-stream"
        });
        startActivityForResult(call, intent, "pickBackupResult");
    }

    @ActivityCallback
    private void pickBackupResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != android.app.Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("status", "cancelled");
            call.resolve(cancelled);
            return;
        }

        Uri uri = data.getData();
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("Não foi possível abrir o arquivo escolhido.");
            byte[] buffer = new byte[8192];
            int total = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
                if (total > MAX_BACKUP_BYTES) throw new IllegalStateException("O arquivo excede o tamanho permitido.");
                output.write(buffer, 0, count);
            }

            JSObject selected = new JSObject();
            selected.put("status", "selected");
            selected.put("content", output.toString(StandardCharsets.UTF_8.name()));
            call.resolve(selected);
        } catch (Exception exception) {
            call.reject("Não foi possível ler o arquivo de backup.", exception);
        }
    }
}
