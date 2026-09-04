package net.filebot.backend.controller;

import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import net.filebot.backend.dto.IntakeRequestDto;
import net.filebot.backend.dto.MediaFileDto;
import net.filebot.backend.dto.SystemStatusDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/app")
public class AppShellController {

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
  public List<MediaFileDto> processFileIntake(@RequestBody IntakeRequestDto request) {
    if (request == null || request.paths() == null) {
      return Collections.emptyList();
    }

    List<MediaFileDto> accepted = new ArrayList<>();
    for (String path : request.paths()) {
      File file = new File(path);
      if (file.exists()) {
        accepted.add(
            new MediaFileDto(
                UUID.randomUUID().toString(),
                file.getAbsolutePath(),
                file.getName(),
                extension(file.getName()),
                file.length(),
                Instant.ofEpochMilli(file.lastModified()),
                file.getParent() != null ? file.getParent() : "",
                file.isDirectory(),
                null,
                Collections.emptyMap()));
      }
    }
    return accepted;
  }

  private String extension(String name) {
    int dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(dot + 1) : "";
  }
}
