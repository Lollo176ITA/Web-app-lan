plugins {
  id("com.android.application")
  kotlin("android")
  id("com.google.devtools.ksp")
}

fun resolvePackageJsonAndroidVersion(): String? {
  val packageJsonFile = rootProject.projectDir.resolve("../package.json").normalize()
  if (!packageJsonFile.isFile) {
    return null
  }

  val match = Regex("\"androidAppVersion\"\\s*:\\s*\"([^\"]+)\"")
    .find(packageJsonFile.readText())

  return match?.groupValues?.getOrNull(1)
}

fun semverToVersionCode(version: String?): Int? {
  val parts = version
    ?.trim()
    ?.split(".")
    ?.mapNotNull { it.toIntOrNull() }
    ?: return null

  if (parts.isEmpty() || parts.size > 3) {
    return null
  }

  val major = parts.getOrElse(0) { 0 }
  val minor = parts.getOrElse(1) { 0 }
  val patch = parts.getOrElse(2) { 0 }

  return (major * 10_000) + (minor * 100) + patch
}

val ciBuild = providers.gradleProperty("ciBuild").orNull == "true"
val releaseKeystoreFile = providers.environmentVariable("ANDROID_RELEASE_KEYSTORE_FILE").orNull
val releaseStorePassword = providers.environmentVariable("ANDROID_RELEASE_STORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("ANDROID_RELEASE_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("ANDROID_RELEASE_KEY_PASSWORD").orNull
val hasReleaseSigning =
  !releaseKeystoreFile.isNullOrBlank() &&
    !releaseStorePassword.isNullOrBlank() &&
    !releaseKeyAlias.isNullOrBlank() &&
    !releaseKeyPassword.isNullOrBlank()

android {
  namespace = "com.routy.sync"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.routy.sync"
    minSdk = 29
    targetSdk = 35

    // CI/local overrides
    val ciVersionCode = providers.gradleProperty("versionCode").orNull?.toIntOrNull()
    val ciVersionName = providers.gradleProperty("versionName").orNull

    // Human-managed version (recommended): pass -PandroidAppVersion=<semver>
    val manualAndroidVersionName = providers.gradleProperty("androidAppVersion").orNull
    val packageJsonAndroidVersion = resolvePackageJsonAndroidVersion()
    val resolvedVersionName = ciVersionName ?: manualAndroidVersionName ?: packageJsonAndroidVersion ?: "0.1.0"

    versionCode = ciVersionCode ?: semverToVersionCode(resolvedVersionName) ?: 1
    versionName = resolvedVersionName
    buildConfigField("String", "GITHUB_REPO_OWNER", "\"Lollo176ITA\"")
    buildConfigField("String", "GITHUB_REPO_NAME", "\"Web-app-lan\"")
    buildConfigField("String", "ANDROID_UPDATE_BRANCH", "\"builds/android-release\"")

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  signingConfigs {
    if (hasReleaseSigning) {
      create("release") {
        storeFile = file(requireNotNull(releaseKeystoreFile))
        storePassword = releaseStorePassword
        keyAlias = releaseKeyAlias
        keyPassword = releaseKeyPassword
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      if (hasReleaseSigning) {
        signingConfig = signingConfigs.getByName("release")
      } else if (ciBuild) {
        signingConfig = signingConfigs.getByName("debug")
      }
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    compose = true
    buildConfig = true
  }

  composeOptions {
    kotlinCompilerExtensionVersion = "1.5.14"
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

dependencies {
  val composeBom = platform("androidx.compose:compose-bom:2024.09.02")

  implementation(composeBom)
  androidTestImplementation(composeBom)

  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.activity:activity-compose:1.9.3")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
  implementation("androidx.compose.ui:ui")
  implementation("androidx.compose.ui:ui-tooling-preview")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.compose.material:material-icons-extended")
  implementation("androidx.documentfile:documentfile:1.0.1")
  implementation("androidx.datastore:datastore-preferences:1.1.1")
  implementation("androidx.room:room-runtime:2.6.1")
  implementation("androidx.room:room-ktx:2.6.1")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")
  implementation("androidx.work:work-runtime-ktx:2.9.1")
  implementation("com.google.errorprone:error_prone_annotations:2.28.0")
  implementation("com.journeyapps:zxing-android-embedded:4.3.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

  ksp("androidx.room:room-compiler:2.6.1")

  debugImplementation("androidx.compose.ui:ui-tooling")
  testImplementation("junit:junit:4.13.2")
}
