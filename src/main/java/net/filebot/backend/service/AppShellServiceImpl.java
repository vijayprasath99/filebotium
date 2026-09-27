package net.filebot.backend.service;

import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import net.filebot.backend.dto.IntakeRequestDto;
import net.filebot.backend.dto.IntakeResultDto;
import net.filebot.backend.dto.MediaFileDto;
import net.filebot.util.FileUtilities;
import org.springframework.stereotype.Service;

@Service
public class AppShellServiceImpl implements AppShellService {

  @Override
  public IntakeResultDto processFileIntake(IntakeRequestDto request) {
    if (request == null || request.paths() == null) {
      return new IntakeResultDto(Collections.emptyList(), 0);
    }

    List<MediaFileDto> accepted = new ArrayList<>();
    int rejectedCount = 0;

    for (String path : request.paths()) {
      File file = new File(path);
      if (!file.exists()) {
        rejectedCount++;
        continue;
      }

      if (file.isDirectory() && request.recursive()) {
        List<File> children =
            FileUtilities.listFiles(
                file, f -> f.isFile() && (!request.filterHidden() || !isHiddenOrJunk(f)));
        for (File child : children) {
          accepted.add(toMediaFileDto(child));
        }
      } else if (!request.filterHidden() || !isHiddenOrJunk(file)) {
        accepted.add(toMediaFileDto(file));
      } else {
        rejectedCount++;
      }
    }

    return new IntakeResultDto(accepted, rejectedCount);
  }

  private boolean isHiddenOrJunk(File file) {
    return file.isHidden() || FileUtilities.isThumbnailStore(file);
  }

  private MediaFileDto toMediaFileDto(File file) {
    return new MediaFileDto(
        UUID.randomUUID().toString(),
        file.getAbsolutePath(),
        file.getName(),
        extension(file.getName()),
        file.length(),
        Instant.ofEpochMilli(file.lastModified()),
        file.getParent() != null ? file.getParent() : "",
        file.isDirectory(),
        null,
        Collections.emptyMap());
  }

  private String extension(String name) {
    int dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(dot + 1) : "";
  }
}
