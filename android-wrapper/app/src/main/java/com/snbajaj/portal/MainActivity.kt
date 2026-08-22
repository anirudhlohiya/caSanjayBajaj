package com.snbajaj.portal

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout

    @Volatile
    private var minVersion: String = "0.0.0"

    @Volatile
    private var latestVersion: String = "0.0.0"

    @Volatile
    private var storeUrl: String =
        "https://play.google.com/store/apps/details?id=com.snbajaj.portal"

    private val updateRequired: Boolean
        get() = compareVersions(BuildConfig.VERSION_NAME, minVersion) < 0

    private val updateAvailable: Boolean
        get() = compareVersions(BuildConfig.VERSION_NAME, latestVersion) < 0

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        swipeRefresh = findViewById(R.id.swipe_refresh)
        webView = findViewById(R.id.web_view)

        setupWebView()
        refreshVersionInfo()
        if (savedInstanceState == null) {
            webView.loadUrl(BuildConfig.APP_URL)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                return handleExternalOrGatedUrl(request.url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleExternalOrGatedUrl(Uri.parse(url))
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                if (updateRequired) {
                    showUpdateDialog(blockingDocumentAction = true)
                    return false
                }
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                try {
                    startActivityForResult(
                        params.createIntent(),
                        FILE_CHOOSER_REQUEST,
                    )
                } catch (e: ActivityNotFoundException) {
                    filePathCallback = null
                    Toast.makeText(this@MainActivity, "No file picker available", Toast.LENGTH_SHORT).show()
                    return false
                }
                return true
            }
        }

        webView.setDownloadListener(downloadListener())

        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
        webView.setOnScrollChangeListener { v, _, scrollY, _, _ ->
            val view = v as WebView
            swipeRefresh.isEnabled = scrollY == 0 && !view.canScrollVertically(-1)
        }
    }

    private fun handleExternalOrGatedUrl(url: Uri): Boolean {
        val scheme = url.scheme ?: return false
        if (scheme != "https" && scheme != "http") return false

        val appHost = Uri.parse(BuildConfig.APP_URL).host
        val host = url.host ?: return false

        // Document/report downloads are signed S3 URLs on a different host.
        val isDocumentDownload =
            host != appHost &&
                (host.contains("s3") || host.endsWith("amazonaws.com"))

        if (isDocumentDownload && updateRequired) {
            showUpdateDialog(blockingDocumentAction = true)
            return true
        }

        if (host == appHost) return false

        return try {
            startActivity(Intent(Intent.ACTION_VIEW, url))
            true
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show()
            true
        }
    }

    private fun downloadListener() = DownloadListener { url, _, contentDisposition, mimeType, _ ->
        if (updateRequired) {
            showUpdateDialog(blockingDocumentAction = true)
            return@DownloadListener
        }
        try {
            val request = DownloadManager.Request(Uri.parse(url)).apply {
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                val name = URLUtil.guessFileName(url, contentDisposition, mimeType)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
                CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
            }
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "Downloading…", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show()
        }
    }

    private fun refreshVersionInfo() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val conn = URL("${BuildConfig.API_BASE_URL}/app/version").openConnection() as HttpURLConnection
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                try {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)
                    minVersion = json.optString("min_version", "0.0.0")
                    latestVersion = json.optString("latest_version", "0.0.0")
                    storeUrl = json.optString("store_url", storeUrl)
                    withContext(Dispatchers.Main) {
                        if (updateRequired) showUpdateDialog(blockingDocumentAction = false)
                        else if (updateAvailable) showSoftUpdateBanner()
                    }
                } finally {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                // Offline or API unreachable: never block the user.
            }
        }
    }

    private fun showSoftUpdateBanner() {
        AlertDialog.Builder(this)
            .setTitle("Update available")
            .setMessage("A newer version of SN Bajaj And Co is available on Google Play.")
            .setPositiveButton("Update") { _, _ -> openStore() }
            .setNegativeButton("Later", null)
            .show()
    }

    private fun showUpdateDialog(blockingDocumentAction: Boolean) {
        val message = if (blockingDocumentAction) {
            "This version of the app can no longer upload or download documents. Please update to continue."
        } else {
            "This version of the app is no longer supported for document actions. Please update to continue."
        }
        AlertDialog.Builder(this)
            .setTitle("Update required")
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("Update now") { _, _ -> openStore() }
            .show()
    }

    private fun openStore() {
        val playIntent = try {
            Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName"))
        } catch (e: ActivityNotFoundException) {
            Intent(Intent.ACTION_VIEW, Uri.parse(storeUrl))
        }
        try {
            startActivity(playIntent)
        } catch (e: ActivityNotFoundException) {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(storeUrl)))
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val results = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST = 1001
    }
}

fun compareVersions(a: String, b: String): Int {
    val pa = a.split(".").map { it.trim().toIntOrNull() ?: 0 }
    val pb = b.split(".").map { it.trim().toIntOrNull() ?: 0 }
    for (i in 0 until maxOf(pa.size, pb.size)) {
        val x = pa.getOrElse(i) { 0 }
        val y = pb.getOrElse(i) { 0 }
        if (x != y) return x - y
    }
    return 0
}
