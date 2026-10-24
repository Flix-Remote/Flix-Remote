package com.flix.homeremote;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import android.content.Intent;
import android.Manifest;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.SpeechRecognizer;
import android.speech.RecognizerIntent;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "HomeDiscovery", permissions = {
    @Permission(alias = "speech", strings = { Manifest.permission.RECORD_AUDIO })
})
public class HomeDiscoveryPlugin extends Plugin {
    private final Handler speechHandler = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private PluginCall speechCall;
    private Runnable speechTimeout;
    @PluginMethod public void recognizeSpeech(PluginCall call) {
        speechHandler.post(() -> {
            // EXTRA_PREFER_OFFLINE is only a hint to arbitrary providers. Never
            // fall back to that service when local recognition is unavailable.
            if (Build.VERSION.SDK_INT < 31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())) {
                call.reject("الإملاء المحلي غير متاح على هذا الجهاز؛ اكتب الأمر"); return;
            }
            if (speechCall != null) { call.reject("الإملاء قيد التشغيل"); return; }
            if (getPermissionState("speech") != PermissionState.GRANTED) {
                requestPermissionForAlias("speech", call, "speechPermission"); return;
            }
            beginLocalSpeech(call);
        });
    }
    @PermissionCallback private void speechPermission(PluginCall call) {
        speechHandler.post(() -> {
            if (getPermissionState("speech") != PermissionState.GRANTED) {
                call.reject("لم تسمح بالميكروفون؛ اكتب الأمر"); return;
            }
            if (speechCall != null) { call.reject("الإملاء قيد التشغيل"); return; }
            beginLocalSpeech(call);
        });
    }
    private void beginLocalSpeech(PluginCall call) {
        if (Build.VERSION.SDK_INT < 31) { call.reject("الإملاء المحلي غير متاح؛ اكتب الأمر"); return; }
        try {
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
            speechCall = call;
            recognizer.setRecognitionListener(new RecognitionListener() {
                public void onReadyForSpeech(Bundle p) {}
                public void onBeginningOfSpeech() {}
                public void onRmsChanged(float rms) {}
                public void onBufferReceived(byte[] bytes) {}
                public void onEndOfSpeech() {}
                public void onPartialResults(Bundle results) {}
                public void onEvent(int type, Bundle p) {}
                public void onError(int code) { finishSpeech(call, null, "تعذر الإملاء المحلي؛ اكتب الأمر"); }
                public void onResults(Bundle results) {
                    java.util.ArrayList<String> rows = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    finishSpeech(call, rows == null || rows.isEmpty() ? "" : rows.get(0), null);
                }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA");
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
            speechTimeout = () -> finishSpeech(call, null, "انتهى وقت الإملاء المحلي؛ اكتب الأمر");
            speechHandler.postDelayed(speechTimeout, 20000);
            recognizer.startListening(intent);
        } catch (Exception error) {
            if (speechCall == null) call.reject("الإملاء المحلي غير متاح؛ اكتب الأمر");
            else finishSpeech(call, null, "الإملاء المحلي غير متاح؛ اكتب الأمر");
        }
    }
    private void finishSpeech(PluginCall expectedCall, String text, String error) {
        if (speechCall != expectedCall) return; // Ignore callbacks from a cancelled session.
        PluginCall call = speechCall; speechCall = null;
        if (speechTimeout != null) { speechHandler.removeCallbacks(speechTimeout); speechTimeout = null; }
        SpeechRecognizer previous = recognizer; recognizer = null;
        if (previous != null) { previous.cancel(); previous.destroy(); }
        if (call == null) return;
        if (error != null) call.reject(error);
        else { JSObject response = new JSObject(); response.put("text", text); call.resolve(response); }
    }
    @Override protected void handleOnDestroy() {
        speechHandler.post(() -> finishSpeech(speechCall, null, "أُلغي الإملاء الصوتي"));
        super.handleOnDestroy();
    }
    @Override protected void handleOnPause() {
        speechHandler.post(() -> finishSpeech(speechCall, null, "أُلغي الإملاء الصوتي"));
        super.handleOnPause();
    }
    // Legacy plugin name retained for installed account vault compatibility. No discovery or hub.
    private SecretKey sessionKey() throws Exception {
        KeyStore keys = KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        String alias = "flix-home-remote-account";
        if (!keys.containsAlias(alias)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build()); generator.generateKey();
        }
        return (SecretKey) keys.getKey(alias, null);
    }
    private String vaultEntry(PluginCall call) {
        String key = call.getString("key", "");
        if ("tv-secrets".equals(key)) return "tv-secrets";
        if ("phone-adb-identity".equals(key)) return "phone-adb-identity";
        return "session";
    }
    @PluginMethod public void saveSession(PluginCall call) {
        try {
            String value = call.getString("value", ""); if (value.length() > 16384) { call.reject("جلسة غير صالحة"); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, sessionKey());
            String encoded = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP);
            getContext().getSharedPreferences("account-vault", Context.MODE_PRIVATE).edit().putString(vaultEntry(call), encoded).commit(); call.resolve();
        } catch (Exception error) { call.reject("تعذر حفظ الجلسة الآمن"); }
    }
    @PluginMethod public void readSession(PluginCall call) {
        try {
            String value = getContext().getSharedPreferences("account-vault", Context.MODE_PRIVATE).getString(vaultEntry(call), ""); JSObject result = new JSObject();
            if (!value.isEmpty()) { String[] parts = value.split(":"); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, sessionKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP))); result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8)); }
            call.resolve(result);
        } catch (Exception error) { call.reject("تعذرت قراءة الجلسة؛ سجّل الدخول مجددًا"); }
    }
    @PluginMethod public void clearSession(PluginCall call) { getContext().getSharedPreferences("account-vault", Context.MODE_PRIVATE).edit().remove(vaultEntry(call)).commit(); call.resolve(); }

}
