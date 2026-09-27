package net.filebot.backend.controller;

import net.filebot.backend.dto.IntakeRequestDto;
import net.filebot.backend.dto.IntakeResultDto;
import net.filebot.backend.dto.SystemStatusDto;
import net.filebot.backend.service.AppShellService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app")
public class AppShellController {

  private final AppShellService appShellService;

  public AppShellController(AppShellService appShellService) {
    this.appShellService = appShellService;
  }

  @GetMapping("/status")
  public SystemStatusDto getSystemStatus() {
    Runtime runtime = Runtime.getRuntime();
    return new SystemStatusDto(
        "FileBot",
        "1.0.0",
        System.getProperty("java.version"),
        System.getProperty("os.name"),
        System.getProperty("os.arch"),
        runtime.freeMemory(),
        runtime.totalMemory());
  }

  @PostMapping("/intake")
  public IntakeResultDto processFileIntake(@RequestBody IntakeRequestDto request) {
    return appShellService.processFileIntake(request);
  }
}
