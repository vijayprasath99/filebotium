package net.filebot.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.prefs.BackingStoreException;
import java.util.prefs.Preferences;
import net.filebot.backend.dto.PresetDto;
import net.filebot.ui.rename.RenamePanel;
import org.springframework.stereotype.Service;

/**
 * Full preset CRUD - previously entirely absent on both frontend and backend
 * (specs/audit/02_03_rename_format_audit.md RF-11). Persisted under the same Preferences node
 * legacy uses for its own Preset Manager (RenamePanel's "presets" child node - see
 * RenamePanel.java:134's Settings.forPackage(RenamePanel.class).node("presets")), though
 * serialized with Jackson rather than legacy's json-io: net.filebot.ui.rename.Preset has no
 * no-arg constructor and its full constructor takes File/ExpressionFilter/Datasource/etc, which
 * the bundled json-io 4.14.1 cannot reflectively instantiate (confirmed via
 * JsonIoException: "Could not instantiate ... using any constructor") - so this preset store is
 * not wire-compatible with legacy's on-disk preset format, only co-located with it.
 */
@Service
public class PresetServiceImpl implements PresetService {

  private static final String KEY_PREFIX = "preset.";

  private final Preferences prefs = Preferences.userNodeForPackage(RenamePanel.class).node("presets");
  private final ObjectMapper mapper = new ObjectMapper();

  @Override
  public List<PresetDto> listPresets() {
    List<PresetDto> result = new ArrayList<>();
    try {
      for (String key : prefs.keys()) {
        if (!key.startsWith(KEY_PREFIX)) {
          continue;
        }
        String json = prefs.get(key, null);
        if (json != null) {
          try {
            result.add(mapper.readValue(json, PresetDto.class));
          } catch (Exception e) {
            // Skip corrupted entries rather than failing the whole list.
          }
        }
      }
    } catch (BackingStoreException e) {
      return List.of();
    }
    return result;
  }

  @Override
  public PresetDto savePreset(PresetDto preset) {
    if (preset == null || preset.name() == null || preset.name().isBlank()) {
      throw new IllegalArgumentException("Preset name is required");
    }
    try {
      prefs.put(KEY_PREFIX + preset.name(), mapper.writeValueAsString(preset));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to save preset", e);
    }
    return preset;
  }

  @Override
  public void deletePreset(String name) {
    if (name != null) {
      prefs.remove(KEY_PREFIX + name);
    }
  }
}
