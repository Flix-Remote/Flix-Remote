// SPDX-License-Identifier: MIT
package com.flix.homeremote;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.Bridge;
import com.getcapacitor.CapacitorWebView;
import dev.daybrite.day.bridge.DayBridge;
import java.util.List;

public final class DayRemoteView extends FrameLayout {
    private final FragmentActivity owner;
    private RemoteFragment remote;
    private boolean pageReady;
    // Day's native-state reader must see the rendered page, not just an empty container.
    @Override public boolean isEnabled() { return super.isEnabled() && pageReady; }
    public static View create() { return new DayRemoteView((FragmentActivity) DayBridge.ctx); }
    private DayRemoteView(FragmentActivity owner) {
        super(owner); this.owner = owner;
        // Stable across Activity recreation so FragmentManager can restore its saved child.
        setId(getResources().getIdentifier("flix_remote_container", "id", owner.getPackageName()));
    }
    @Override protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (remote == null && !owner.isFinishing() && !owner.getSupportFragmentManager().isStateSaved()) {
            Fragment restored = owner.getSupportFragmentManager().findFragmentByTag("flix-remote");
            if (restored instanceof RemoteFragment) remote = (RemoteFragment) restored;
            else {
                remote = new RemoteFragment();
                owner.getSupportFragmentManager().beginTransaction().add(getId(), remote, "flix-remote").commitNow();
            }
        }
    }
    @Override protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        owner.getWindow().getDecorView().post(() -> {
            if (!isAttachedToWindow() && remote != null && !owner.isDestroyed()) {
                owner.getSupportFragmentManager().beginTransaction().remove(remote).commitNowAllowingStateLoss();
                remote = null;
            }
        });
    }
    public static final class RemoteFragment extends Fragment {
        private Bridge bridge;
        private androidx.core.util.Consumer<android.content.Intent> newIntent;
        @Override public View onCreateView(@NonNull LayoutInflater inflater, ViewGroup container, Bundle state) {
            CapacitorWebView web = new CapacitorWebView(requireContext(), null);
            web.setId(com.getcapacitor.android.R.id.webview);
            web.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
            return web;
        }
        @Override public void onViewCreated(@NonNull View view, Bundle state) {
            super.onViewCreated(view, state);
            bridge = new Bridge.Builder(this).setInstanceState(state).addPlugins(List.of(
                HomeDiscoveryPlugin.class, DirectLanPlugin.class, DirectAdbPlugin.class,
                com.capacitorjs.plugins.app.AppPlugin.class,
                com.capacitorjs.plugins.filesystem.FilesystemPlugin.class,
                com.capacitorjs.plugins.preferences.PreferencesPlugin.class,
                com.capacitorjs.plugins.share.SharePlugin.class
            )).create();
            newIntent = intent -> { if (bridge != null) bridge.onNewIntent(intent); };
            requireActivity().addOnNewIntentListener(newIntent);
            checkPage(0);
        }
        private void checkPage(int attempt) {
            if (bridge == null || !isAdded()) return;
            android.webkit.WebView web = bridge.getWebView();
            web.evaluateJavascript("(() => { const f = document.getElementById('original-remote'); const d = f?.contentDocument; const p = d?.getElementById('tvPick'); return !!(p && p.getBoundingClientRect().width > 100 && innerWidth > 200 && innerHeight > 200); })()", result -> {
                if (bridge == null || !isAdded()) return;
                DayRemoteView host = (DayRemoteView) getView().getParent();
                host.pageReady = "true".equals(result) && web.getWidth() > 200 && web.getHeight() > 200;
                if (host.pageReady) android.util.Log.i("day-android", "FLIX original remote DOM and native frame ready");
                else if (attempt < 120) web.postDelayed(() -> checkPage(attempt + 1), 250);
                else android.util.Log.e("day-android", "FLIX original remote did not render in its native frame");
            });
        }
        @Override public void onStart() { super.onStart(); if (bridge != null) bridge.onStart(); }
        @Override public void onResume() { super.onResume(); if (bridge != null) bridge.onResume(); }
        @Override public void onPause() { if (bridge != null) bridge.onPause(); super.onPause(); }
        @Override public void onStop() { if (bridge != null) bridge.onStop(); super.onStop(); }
        @Override public void onSaveInstanceState(@NonNull Bundle state) {
            super.onSaveInstanceState(state); if (bridge != null) bridge.saveInstanceState(state);
        }
        @Override public void onDestroyView() {
            if (newIntent != null) { requireActivity().removeOnNewIntentListener(newIntent); newIntent = null; }
            if (bridge != null) { bridge.onDestroy(); bridge = null; }
            super.onDestroyView();
        }
    }
}
