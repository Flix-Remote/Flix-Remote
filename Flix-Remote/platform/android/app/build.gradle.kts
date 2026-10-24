import java.security.MessageDigest
import groovy.json.JsonOutput
import org.gradle.api.artifacts.component.ModuleComponentIdentifier
import org.gradle.api.artifacts.component.ProjectComponentIdentifier

plugins {
    // Configures this module from Day.toml and the app's pieces
    // (https://daybrite.dev/docs/platforms/android-mdc#the-gradle-project).
    id("dev.daybrite.day.android")
}

// This app's own Android settings and libraries. They apply after Day's plugin, so they win.
android {
    defaultConfig { minSdk = 24 }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_21; targetCompatibility = JavaVersion.VERSION_21 }
    // Capacitor and Cordova require AppCompatActivity. Its superclass is FragmentActivity,
    // so Day keeps its existing FragmentManager, ActivityResult and JNI lifecycle intact.
    // Mirror only the resolved Day Java shim; do not mutate the Cargo checkout or Capacitor.
    sourceSets.getByName("main").java.apply {
        val activity = "dev/daybrite/day/bridge/DayActivity.java"
        val upstream = directories.map { file(it) }.single { it.resolve(activity).isFile }
        val generated = rootProject.file("../../build/bridge/day-java").canonicalFile
        val allowed = rootProject.file("../../build/bridge").canonicalFile
        check(generated.toPath().startsWith(allowed.toPath()))
        val before = upstream.resolve(activity).readText()
        val base = "extends androidx.fragment.app.FragmentActivity"
        check(before.split(base).size == 2) { "DayActivity base-class adapter drift" }
        upstream.copyRecursively(generated, overwrite = true)
        val after = before.replace(base, "extends androidx.appcompat.app.AppCompatActivity")
        generated.resolve(activity).writeText(after)
        check(directories.remove(upstream.path)) { "Day shim source root was not replaced" }
        directories.add(generated.path)
        fun sha(value: String) = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
        allowed.resolve("day-activity-adapter.json").writeText(
            """{"source":"daybrite/day@2c787ecae32a59cf58260aca95b51a4b1bd98d41","file":"$activity","license":"MPL-2.0","before":"${sha(before)}","after":"${sha(after)}"}""" + "\n"
        )
    }
}

dependencies {
    listOf("android", "app", "filesystem", "preferences", "share").forEach { name ->
        implementation(project(":capacitor-$name"))
    }
}

// Evidence only: resolving the actual packaged runtime graph is not license approval
// and does not prove that these Maven binaries can be reproduced from source.
tasks.register("flixDependencyReview") {
    doLast {
        val configuration = configurations.getByName("releaseRuntimeClasspath")
        // Hash original external Maven artifacts. Local Android projects expose
        // several AGP secondary artifacts, so the legacy untyped artifact query
        // is ambiguous. They remain in the complete graph below and their
        // reviewed source is captured by the locked npm/source inventories.
        val artifacts = configuration.incoming.artifactView {
            componentFilter { it is ModuleComponentIdentifier }
        }.artifacts.artifacts.map { artifact ->
            val module = artifact.id.componentIdentifier as ModuleComponentIdentifier
            mapOf("coordinate" to "${module.group}:${module.module}:${module.version}", "name" to artifact.file.name,
                "sha256" to MessageDigest.getInstance("SHA-256").digest(artifact.file.readBytes()).joinToString("") { "%02x".format(it) })
        }.sortedBy { it["coordinate"] }
        val graph = configuration.incoming.resolutionResult.allComponents.map { component ->
            check(component.id is ModuleComponentIdentifier || component.id is ProjectComponentIdentifier) {
                "Unreviewed runtime component type: ${component.id}"
            }
            mapOf("id" to component.id.displayName,
                "kind" to if (component.id is ModuleComponentIdentifier) "maven" else "source-project",
                "dependencies" to component.dependencies.map { it.requested.displayName }.sorted())
        }.sortedBy { it["id"].toString() }
        val out = rootProject.file("../../build/bridge/native-runtime.json")
        out.parentFile.mkdirs()
        out.writeText(JsonOutput.prettyPrint(JsonOutput.toJson(mapOf("configuration" to configuration.name,
            "artifact_scope" to "external Maven files; local projects retained in graph and source inventory",
            "artifacts" to artifacts, "graph" to graph))) + "\n")
    }
}
