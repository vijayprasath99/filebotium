package net.filebot.backend.service;

import static net.filebot.media.XattrMetaInfo.xattr;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import net.filebot.MediaTypes;
import net.filebot.archive.Archive;
import net.filebot.media.MediaDetection;
import net.filebot.media.MetaAttributes;
import net.filebot.backend.dto.ArchiveEntryDto;
import net.filebot.backend.dto.FileGroupDto;
import net.filebot.util.FileUtilities;
import net.filebot.vfs.FileInfo;
import org.springframework.stereotype.Service;

@Service
public class AnalyzeServiceImpl implements AnalyzeService {

  private static final long ONE_MEGABYTE = 1024 * 1024;

  @Override
  public List<ArchiveEntryDto> listArchiveEntries(String archiveFilePath) {
    if (archiveFilePath == null || archiveFilePath.isBlank()) {
      return Collections.emptyList();
    }
    File archiveFile = new File(archiveFilePath);
    if (!archiveFile.exists()) {
      return Collections.emptyList();
    }

    try (Archive archive = Archive.open(archiveFile)) {
      List<FileInfo> entries = archive.listFiles();
      List<ArchiveEntryDto> dtos = new ArrayList<>();
      for (FileInfo entry : entries) {
        dtos.add(new ArchiveEntryDto(entry.getName(), entry.getPath(), entry.getLength()));
      }
      return dtos;
    } catch (Exception e) {
      return Collections.emptyList();
    }
  }

  @Override
  public List<FileGroupDto> groupIntoParts(List<String> filePaths, long splitSizeMB) {
    if (filePaths == null || filePaths.isEmpty()) {
      return Collections.emptyList();
    }

    long splitSize = (splitSizeMB > 0 ? splitSizeMB : 4480) * ONE_MEGABYTE;

    List<File> files =
        filePaths.stream().map(File::new).filter(File::isFile).sorted().collect(Collectors.toList());

    List<FileGroupDto> groups = new ArrayList<>();
    int nextPart = 1;
    long totalSize = 0;
    List<File> currentPart = new ArrayList<>();
    List<File> remainder = new ArrayList<>();

    for (File f : files) {
      long fileSize = f.length();

      if (fileSize > splitSize) {
        remainder.add(f);
        continue;
      }

      if (totalSize + fileSize > splitSize && !currentPart.isEmpty()) {
        groups.add(toGroup("Disk " + nextPart++, currentPart));
        totalSize = 0;
        currentPart = new ArrayList<>();
      }

      totalSize += fileSize;
      currentPart.add(f);
    }

    if (!currentPart.isEmpty()) {
      groups.add(toGroup("Disk " + nextPart, currentPart));
    }
    if (!remainder.isEmpty()) {
      groups.add(toGroup("Remainder", remainder));
    }

    return groups;
  }

  @Override
  public List<FileGroupDto> classifyByType(List<String> filePaths) {
    if (filePaths == null || filePaths.isEmpty()) {
      return Collections.emptyList();
    }

    List<File> files = filePaths.stream().map(File::new).collect(Collectors.toList());

    Map<String, java.io.FileFilter> metaTypes = new LinkedHashMap<>();
    metaTypes.put("Movie", f -> MediaDetection.isMovie(f, true));
    metaTypes.put("Episode", f -> MediaDetection.isEpisode(f, true));
    metaTypes.put("Disk Folder", MediaDetection.getDiskFolderFilter());
    metaTypes.put("Video", MediaTypes.VIDEO_FILES);
    metaTypes.put("Subtitle", MediaTypes.SUBTITLE_FILES);
    metaTypes.put("Audio", MediaTypes.AUDIO_FILES);
    metaTypes.put("Archive", MediaTypes.ARCHIVE_FILES);
    metaTypes.put("Verification", MediaTypes.VERIFICATION_FILES);
    metaTypes.put("Extras", MediaDetection.getClutterFileFilter());
    metaTypes.put("Clutter", MediaDetection.getClutterTypeFilter());

    List<FileGroupDto> groups = new ArrayList<>();
    for (Map.Entry<String, java.io.FileFilter> entry : metaTypes.entrySet()) {
      List<File> selection = files.stream().filter(entry.getValue()::accept).collect(Collectors.toList());
      if (!selection.isEmpty()) {
        groups.add(toGroup(entry.getKey(), selection));
      }
    }

    Map<String, List<File>> byExtension =
        FileUtilities.mapByExtension(files.stream().filter(File::isFile).collect(Collectors.toList()));
    byExtension.entrySet().stream()
        .filter(e -> e.getKey() != null)
        .sorted(Map.Entry.comparingByKey(String.CASE_INSENSITIVE_ORDER))
        .forEach(e -> groups.add(toGroup(e.getKey(), e.getValue())));

    return groups;
  }

  @Override
  public Map<String, String> getFileAttributes(String filePath) {
    if (filePath == null || filePath.isBlank()) {
      return Collections.emptyMap();
    }
    File file = new File(filePath);
    if (!file.exists()) {
      return Collections.emptyMap();
    }

    Map<String, String> attributes = new LinkedHashMap<>();
    try {
      String originalName = xattr.getOriginalName(file);
      if (originalName != null) {
        attributes.put("originalName", originalName);
      }
      Object metaInfo = xattr.getMetaInfo(file);
      if (metaInfo != null) {
        attributes.put("metadata", MetaAttributes.toJson(metaInfo));
      }
    } catch (Exception e) {
      // No extended attributes available on this platform/file - return what we have so far.
    }
    return attributes;
  }

  private FileGroupDto toGroup(String name, List<File> files) {
    long totalSize = files.stream().mapToLong(File::length).sum();
    List<String> paths = files.stream().map(File::getAbsolutePath).collect(Collectors.toList());
    return new FileGroupDto(name, paths, totalSize);
  }
}
