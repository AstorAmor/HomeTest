package expo.modules.kuovawallpaper

import android.app.WallpaperManager
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream

// Kuova (2026-11-06): pone la imagen de la tarjeta de emergencia («Bloqueo») solo como fondo de la pantalla
// de bloqueo, sin tocar el de inicio (WallpaperManager.FLAG_LOCK, Android 7+). En iOS no existe: las apps no
// pueden poner fondos, la app guía con los pasos de Fotos.
class WallpaperNotAllowedException :
  CodedException("ERR_WALLPAPER_NOT_ALLOWED", "This device does not let apps set the wallpaper", null)

class KuovaWallpaperModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KuovaWallpaper")

    // uri: file:// de la imagen ya guardada en la caché de la app (o content://)
    AsyncFunction("setLockScreen") { uri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val manager = WallpaperManager.getInstance(context)
      if (!manager.isWallpaperSupported || !manager.isSetWallpaperAllowed) throw WallpaperNotAllowedException()
      val parsed = Uri.parse(uri)
      val stream =
        if (parsed.scheme == null || parsed.scheme == "file") FileInputStream(File(parsed.path ?: uri))
        else context.contentResolver.openInputStream(parsed) ?: throw IllegalArgumentException("Cannot open $uri")
      stream.use { manager.setStream(it, null, true, WallpaperManager.FLAG_LOCK) }
      true
    }
  }
}
