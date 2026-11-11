package expo.modules.kuovaprivacy

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Kuova (2026-11-11): con el bloqueo de Face ID / huella activado, la miniatura de Kuova en «apps recientes»
// sale en blanco (Activity.setRecentsScreenshotEnabled, Android 13+), sin impedir las capturas de pantalla como
// haría FLAG_SECURE. En Android 12 o anterior no hace nada (devuelve false) y queda la capa de la marca que la
// app pone al pasar a segundo plano.
class KuovaPrivacyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KuovaPrivacy")

    Function("setHideInRecents") { hide: Boolean ->
      val activity = appContext.currentActivity
      if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        false
      } else {
        activity.runOnUiThread { activity.setRecentsScreenshotEnabled(!hide) }
        true
      }
    }
  }
}
