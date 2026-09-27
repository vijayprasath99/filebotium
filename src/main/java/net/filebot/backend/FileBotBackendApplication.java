package net.filebot.backend;

import net.filebot.ApplicationFolder;
import net.filebot.util.prefs.FilePreferencesFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class FileBotBackendApplication {

  static {
    // Install the portable, OS-registry-independent Preferences backend before any Preferences
    // node is touched (java.util.prefs.Preferences caches its PreferencesFactory on first use) -
    // mirrors legacy Swing's FilePreferencesFactory installation, so Settings persist to a flat
    // file under ~/.filebot instead of the Windows Registry / macOS plist / Linux XML store.
    if (System.getProperty("java.util.prefs.PreferencesFactory") == null) {
      System.setProperty(
          "java.util.prefs.PreferencesFactory", FilePreferencesFactory.class.getName());
    }
    if (System.getProperty("net.filebot.util.prefs.file") == null) {
      System.setProperty(
          "net.filebot.util.prefs.file", ApplicationFolder.AppData.resolve("prefs.properties").getPath());
    }
  }

  public static void main(String[] args) {
    SpringApplication.run(FileBotBackendApplication.class, args);
  }
}
