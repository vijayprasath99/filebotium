package net.filebot.backend.service;

import java.util.List;
import java.util.Map;
import net.filebot.backend.dto.ArchiveEntryDto;
import net.filebot.backend.dto.FileGroupDto;

public interface AnalyzeService {

  List<ArchiveEntryDto> listArchiveEntries(String archiveFilePath);

  List<FileGroupDto> groupIntoParts(List<String> filePaths, long splitSizeMB);

  List<FileGroupDto> classifyByType(List<String> filePaths);

  Map<String, String> getFileAttributes(String filePath);
}
