import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// App notifications (Firebase Cloud Messaging). The Firebase config file
// app/google-services.json is downloaded from the Firebase console and NEVER
// committed. Without it the app still builds and runs; notifications stay off
// (NativePush.available() returns false). See README "App notifications".
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

// Upload-key signing for Play Store builds. keystore.properties (and the .jks
// it points to) live next to settings.gradle.kts and are NEVER committed.
// See README "Release signing". Without the file, release builds are unsigned.
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

android {
    namespace = "com.snbajaj.portal"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.snbajaj.portal"
        minSdk = 24
        // Google Play requires API 36 for new apps and updates from 31 Aug 2026.
        targetSdk = 36
        // +1 on every Play upload; versionName is what the forced-update gate compares.
        versionCode = 4
        versionName = "1.2.0"
    }

    signingConfigs {
        if (keystorePropsFile.exists()) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            buildConfigField("String", "APP_URL", "\"https://app.snbajaj.com\"")
            buildConfigField("String", "API_BASE_URL", "\"https://api.snbajaj.com/api/v1\"")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.findByName("release")
            buildConfigField("String", "APP_URL", "\"https://app.snbajaj.com\"")
            buildConfigField("String", "API_BASE_URL", "\"https://api.snbajaj.com/api/v1\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-messaging")
}
