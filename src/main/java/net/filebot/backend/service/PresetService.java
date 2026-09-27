package net.filebot.backend.service;

import java.util.List;
import net.filebot.backend.dto.PresetDto;

public interface PresetService {

  List<PresetDto> listPresets();

  PresetDto savePreset(PresetDto preset);

  void deletePreset(String name);
}
