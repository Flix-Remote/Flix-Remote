plugins {
    // Configures this module from Day.toml and the app's pieces
    // (https://daybrite.dev/docs/platforms/android-mdc#the-gradle-project).
    id("dev.daybrite.day.android")
}

// This app's own Android settings and libraries. They apply after Day's plugin, so they win.
android {
    defaultConfig { minSdk = 24 }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_21; targetCompatibility = JavaVersion.VERSION_21 }
}

dependencies {
    listOf("android", "app", "filesystem", "preferences", "share").forEach { name ->
        implementation(project(":capacitor-$name"))
    }
}
