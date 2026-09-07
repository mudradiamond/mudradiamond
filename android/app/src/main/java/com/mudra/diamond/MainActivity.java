package com.mudra.diamond;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Mudra Diamond — Android shell.
 *
 * The app is the web app: this activity is a WebView pointed at the live site,
 * so publishing the website updates every phone with no new APK. The site
 * registers a service worker, so once it has been opened successfully the app
 * still starts and shows the last data when the phone has no internet, and any
 * entry made offline is queued by the web app and uploaded later.
 */
public class MainActivity extends Activity {

    private WebView web;
    private boolean loadFailed = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage — the app's data lives here
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        CookieManager.getInstance().setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        }

        web.addJavascriptInterface(new Bridge(), "MudraBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new Client());
        web.setDownloadListener(new Downloads());

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(BuildConfig.START_URL);
    }

    /* ---------------------------------------------------------------- nav */

    private class Client extends WebViewClient {

        @Override
        @SuppressWarnings("deprecation")
        public boolean shouldOverrideUrlLoading(WebView v, String url) {
            return handleUrl(url);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
            return handleUrl(req.getUrl().toString());
        }

        private boolean handleUrl(String url) {
            if (url == null) return false;
            // keep the app's own site inside the WebView
            if (url.startsWith(startOrigin())) return false;
            if (url.startsWith("http://") || url.startsWith("https://")
                    || url.startsWith("tel:") || url.startsWith("mailto:")
                    || url.startsWith("whatsapp:")) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                } catch (ActivityNotFoundException e) {
                    return false;
                }
            }
            return false;
        }

        @Override
        public void onPageStarted(WebView v, String url, android.graphics.Bitmap f) {
            loadFailed = false;
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            if (loadFailed) return;
            // route the web app's Print button through Android's print service,
            // and its Excel download through the Android file saver
            v.evaluateJavascript(
                "(function(){"
              + "  window.print = function(){ MudraBridge.printPage(); };"
              + "  window.__mudraSaveBlob = function(u, n){"
              + "    var x = new XMLHttpRequest(); x.open('GET', u, true); x.responseType='blob';"
              + "    x.onload = function(){ var r = new FileReader();"
              + "      r.onloadend = function(){ MudraBridge.saveBase64(r.result, n); };"
              + "      r.readAsDataURL(x.response); };"
              + "    x.onerror = function(){ MudraBridge.toast('Download નિષ્ફળ'); };"
              + "    x.send();"
              + "  };"
              + "})();", null);
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onReceivedError(WebView v, int code, String desc, String failingUrl) {
            if (failingUrl != null && failingUrl.equals(web.getUrl())) showOffline();
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest req,
                                    android.webkit.WebResourceError err) {
            if (req.isForMainFrame()) showOffline();
        }
    }

    private String startOrigin() {
        Uri u = Uri.parse(BuildConfig.START_URL);
        return u.getScheme() + "://" + u.getAuthority();
    }

    private void showOffline() {
        loadFailed = true;
        String html =
            "<!doctype html><html lang='gu'><head><meta charset='utf-8'>"
          + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
          + "<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;"
          + "background:#111;color:#fff;font-family:sans-serif;text-align:center;padding:24px}"
          + "h2{color:#d8b45a;margin:0 0 10px}p{color:#bbb;line-height:1.6;font-size:15px}"
          + "button{margin-top:20px;border:0;border-radius:10px;padding:13px 26px;background:#b88724;"
          + "color:#fff;font-weight:700;font-size:15px}</style></head><body><div>"
          + "<h2>💎 કનેક્શન નથી</h2>"
          + "<p>Internet ન મળ્યું.<br>એક વાર app ખૂલ્યા પછી offline પણ ચાલશે.<br>"
          + "Net ચાલુ કરીને ફરી પ્રયત્ન કરો.</p>"
          + "<button onclick='MudraBridge.retry()'>ફરી પ્રયત્ન કરો</button>"
          + "</div></body></html>";
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack() && !loadFailed) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(code, e);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    /* ----------------------------------------------------------- downloads */

    private class Downloads implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String ua, String disposition,
                                    String mime, long size) {
            String name = URLUtil.guessFileName(url, disposition, mime);
            if (url.startsWith("blob:")) {
                // a blob can only be read by the page that made it
                web.evaluateJavascript(
                    "window.__mudraSaveBlob('" + url + "','" + name + "');", null);
            } else if (url.startsWith("data:")) {
                int comma = url.indexOf(',');
                if (comma > 0) saveBytes(Base64.decode(url.substring(comma + 1), Base64.DEFAULT), name);
            } else {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (ActivityNotFoundException ex) {
                    toast("Download ખોલી ન શકાયું");
                }
            }
        }
    }

    private void saveBytes(byte[] bytes, String name) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                cv.put(MediaStore.Downloads.MIME_TYPE, "text/csv");
                cv.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri item = getContentResolver()
                        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (item == null) { toast("File save ન થઈ"); return; }
                OutputStream os = getContentResolver().openOutputStream(item);
                os.write(bytes);
                os.close();
                cv.clear();
                cv.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(item, cv, null, null);
            } else {
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 1);
                    toast("Storage permission આપીને ફરી try કરો");
                    return;
                }
                File dir = Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS);
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(bytes);
                fos.close();
            }
            toast("Downloads માં save થયું: " + name);
        } catch (Exception e) {
            toast("Save error: " + e.getMessage());
        }
    }

    private void toast(final String msg) {
        runOnUiThread(new Runnable() {
            public void run() { Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show(); }
        });
    }

    /* -------------------------------------------------------------- bridge */

    private class Bridge {
        @JavascriptInterface
        public void saveBase64(String dataUrl, String name) {
            int comma = dataUrl.indexOf(',');
            if (comma < 0) { toast("File save ન થઈ"); return; }
            saveBytes(Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT), name);
        }

        @JavascriptInterface
        public void printPage() {
            runOnUiThread(new Runnable() {
                public void run() {
                    PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                    if (pm == null) { toast("Print સેવા મળી નથી"); return; }
                    PrintDocumentAdapter ad =
                            web.createPrintDocumentAdapter("Mudra Diamond Report");
                    pm.print("Mudra Diamond Report", ad,
                            new PrintAttributes.Builder().build());
                }
            });
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(new Runnable() {
                public void run() { loadFailed = false; web.loadUrl(BuildConfig.START_URL); }
            });
        }

        @JavascriptInterface
        public void toast(String msg) { MainActivity.this.toast(msg); }
    }
}
