package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.PresetDto;
import net.filebot.backend.service.PresetService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/presets")
public class PresetController {

  private final PresetService presetService;

  public PresetController(PresetService presetService) {
    this.presetService = presetService;
  }

  @GetMapping
  public List<PresetDto> listPresets() {
    return presetService.listPresets();
  }

  @PostMapping
  public PresetDto savePreset(@RequestBody PresetDto preset) {
    return presetService.savePreset(preset);
  }

  @DeleteMapping("/{name}")
  public void deletePreset(@PathVariable("name") String name) {
    presetService.deletePreset(name);
  }
}
