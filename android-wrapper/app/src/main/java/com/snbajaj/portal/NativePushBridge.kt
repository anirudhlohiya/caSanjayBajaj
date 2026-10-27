package com.snbajaj.portal

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

/**
 * Exposed to the portal page as `window.NativePush` so the web app can use
 * Android notifications instead of browser web push (which WebView lacks).
 *
 *   NativePush.available()          → false until google-services.json is built in
 *   NativePush.permission()         → "granted" | "denied" | "default"
 *   NativePush.requestPermission()  → later calls window.onNativePushPermission(state)
 *   NativePush.requestToken()       → later calls window.onNativePushToken(token | "")
 *
 * Only the portal host is ever loaded in the WebView (other links open in the
 * browser), so no other site can reach this bridge.
 */
class NativePushBridge(
    private val activity: AppCompatActivity,
    private val webView: WebView,
) {
    private val firebaseReady: Boolean
        get() = FirebaseApp.getApps(activity).isNotEmpty()

    @JavascriptInterface
    fun available(): Boolean = firebaseReady

    @JavascriptInterface
    fun permission(): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted"
        val granted = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) return "granted"
        val asked = activity.getSharedPreferences(PushMessagingService.PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_ASKED, false)
        return if (asked) "denied" else "default"
    }

    @JavascriptInterface
    fun requestPermission() {
        activity.runOnUiThread {
            if (permission() == "granted") {
                deliver("onNativePushPermission", "granted")
                return@runOnUiThread
            }
            activity.getSharedPreferences(PushMessagingService.PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ASKED, true).apply()
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQUEST_CODE,
            )
        }
    }

    /** Called by MainActivity.onRequestPermissionsResult. */
    fun onPermissionResult() = deliver("onNativePushPermission", permission())

    @JavascriptInterface
    fun requestToken() {
        if (!firebaseReady) {
            deliver("onNativePushToken", "")
            return
        }
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            val token = if (task.isSuccessful) task.result.orEmpty() else ""
            if (token.isNotEmpty()) {
                activity.getSharedPreferences(PushMessagingService.PREFS, Context.MODE_PRIVATE)
                    .edit().putString(PushMessagingService.KEY_TOKEN, token).apply()
            }
            deliver("onNativePushToken", token)
        }
    }

    private fun deliver(callback: String, value: String) {
        val arg = JSONObject.quote(value)
        activity.runOnUiThread {
            webView.evaluateJavascript(
                "window.$callback && window.$callback($arg)",
                null,
            )
        }
    }

    companion object {
        const val REQUEST_CODE = 2001
        private const val KEY_ASKED = "permission_asked"
    }
}
