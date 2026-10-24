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
    private long probeGeneration;
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
        pageReady = false;
        probeGeneration++;
        if (remote == null && !owner.isFinishing() && !owner.getSupportFragmentManager().isStateSaved()) {
            Fragment restored = owner.getSupportFragmentManager().findFragmentByTag("flix-remote");
            if (restored instanceof RemoteFragment) remote = (RemoteFragment) restored;
            else {
                remote = new RemoteFragment();
                owner.getSupportFragmentManager().beginTransaction().add(getId(), remote, "flix-remote").commitNow();
            }
        }
        // Restored/reattached fragments need a new probe after the parent is
        // attached; the detached generation is deliberately invalidated.
        post(() -> { if (isAttachedToWindow() && remote != null) remote.checkPage(0); });
    }
    @Override protected void onDetachedFromWindow() {
        pageReady = false;
        probeGeneration++;
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
        private long visualRequest;
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
            if (!(getView().getParent() instanceof DayRemoteView)) return;
            DayRemoteView host = (DayRemoteView) getView().getParent();
            long generation = host.probeGeneration;
            web.evaluateJavascript("(() => { const f = document.getElementById('original-remote'); const d = f?.contentDocument; const p = d?.getElementById('tvPick'); const r = f?.getBoundingClientRect(); return !!(p && p.getBoundingClientRect().width > 100 && innerWidth > 200 && innerHeight > 200 && f.dataset.flixPainted === 'true' && !document.querySelector('dialog[open]') && !d.querySelector('dialog[open]') && !document.body.classList.contains('native-sheet-open') && document.elementFromPoint(r.x+r.width/2,r.y+Math.min(30,r.height/2)) === f); })()", result -> {
                if (bridge == null || !isAdded()) return;
                if (!host.isAttachedToWindow() || generation != host.probeGeneration) return;
                if ("true".equals(result) && web.getWidth() > 200 && web.getHeight() > 200) {
                    // DOM evaluation precedes Chromium's compositor. Do not let
                    // native readiness pass while a system capture is still blank.
                    web.postVisualStateCallback(++visualRequest, new android.webkit.WebView.VisualStateCallback() {
                        @Override public void onComplete(long requestId) {
                            if (bridge == null || !host.isAttachedToWindow() || generation != host.probeGeneration) return;
                            host.pageReady = true;
                            web.invalidate();
                            android.util.Log.i("Day", "FLIX original remote DOM, native frame and compositor ready; probe=" + attempt);
                        }
                    });
                } else {
                    if (attempt == 10 || attempt == 20 || attempt == 40 || attempt == 120) {
                        web.evaluateJavascript("JSON.stringify((()=>{const f=document.getElementById('original-remote'),d=f?.contentDocument,p=d?.getElementById('tvPick'),r=f?.getBoundingClientRect();return {state:document.readyState,control:!!p,controlWidth:p?.getBoundingClientRect().width||0,width:innerWidth,height:innerHeight,painted:f?.dataset.flixPainted,overlay:!!document.querySelector('dialog[open]')||!!d?.querySelector('dialog[open]')||document.body.classList.contains('native-sheet-open'),hit:!!r&&document.elementFromPoint(r.x+r.width/2,r.y+Math.min(30,r.height/2))===f};})())", state -> android.util.Log.i("Day", "FLIX readiness pending; probe=" + attempt + "; native=" + web.getWidth() + "x" + web.getHeight() + "; page=" + state));
                    }
                    if (attempt < 120) web.postDelayed(() -> checkPage(attempt + 1), 250);
                    else android.util.Log.e("Day", "FLIX original remote did not render in its native frame");
                }
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
