package net.filebot.backend.service;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import net.filebot.Language;
import net.filebot.WebServices;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.SubtitleFormat;
import net.filebot.backend.domain.SubtitleProviderType;
import net.filebot.backend.domain.SubtitleSearchStrategy;
import net.filebot.backend.dto.SubtitleDescriptorDto;
import net.filebot.backend.dto.SubtitleDownloadRequestDto;
import net.filebot.backend.dto.SubtitleDownloadResultDto;
import net.filebot.backend.dto.SubtitleSearchRequestDto;
import net.filebot.backend.dto.SubtitleUploadRequestDto;
import net.filebot.subtitle.SubtitleNaming;
import net.filebot.subtitle.SubtitleUtilities;
import net.filebot.vfs.MemoryFile;
import net.filebot.web.OpenSubtitlesHasher;
import net.filebot.web.SubtitleDescriptor;
import net.filebot.web.VideoHashSubtitleService;
import org.springframework.stereotype.Service;

@Service
public class SubtitleServiceImpl implements SubtitleService {

  // Maps a search result's synthetic id back to the real provider descriptor so download()
  // can fetch it. Session-scoped (in-memory only) - a client must download within the same
  // backend session/instance that served the search, matching how the search UI is used in
  // practice (search then immediately download).
  private final Map<String, SubtitleDescriptor> descriptorCache = new ConcurrentHashMap<>();

  @Override
  public String readSubtitleContent(String filePath) {
    if (filePath == null || filePath.isBlank()) {
      return "";
    }
    try {
      File file = new File(filePath);
      if (!file.exists() || file.length() > 5 * 1024 * 1024) {
        return "";
      }
      return java.nio.file.Files.readString(file.toPath(), java.nio.charset.StandardCharsets.UTF_8);
    } catch (Exception e) {
      return "";
    }
  }

  @Override
  public String computeOpenSubtitlesHash(String filePath) {
    if (filePath == null || filePath.isBlank()) {
      return "";
    }
    try {
      File file = new File(filePath);
      if (!file.exists()) {
        return "";
      }
      return OpenSubtitlesHasher.computeHash(file);
    } catch (Exception e) {
      return "";
    }
  }

  @Override
  public List<SubtitleDescriptorDto> searchSubtitles(SubtitleSearchRequestDto request) {
    if (request == null || request.videoFilePaths() == null || request.videoFilePaths().isEmpty()) {
      return Collections.emptyList();
    }

    List<File> videoFiles =
        request.videoFilePaths().stream().map(File::new).collect(Collectors.toList());
    Locale locale = resolveLocale(request.language());
    SubtitleProviderType providerType =
        request.provider() != null ? request.provider() : SubtitleProviderType.OPEN_SUBTITLES;

    Map<File, List<SubtitleDescriptor>> resultsByFile;
    try {
      if (providerType == SubtitleProviderType.SHOOTER) {
        // Shooter is a hash-only lookup service - no name-search variant exists.
        resultsByFile =
            SubtitleUtilities.lookupSubtitlesByHash(WebServices.Shooter, videoFiles, locale, true, false);
      } else if (request.strategy() == SubtitleSearchStrategy.FUZZY) {
        resultsByFile =
            SubtitleUtilities.findSubtitlesByName(
                WebServices.OpenSubtitles, videoFiles, locale, null, true, false);
      } else {
        resultsByFile =
            SubtitleUtilities.lookupSubtitlesByHash(
                (VideoHashSubtitleService) WebServices.OpenSubtitles, videoFiles, locale, true, false);
      }
    } catch (Exception e) {
      return Collections.emptyList();
    }

    List<SubtitleDescriptorDto> dtos = new ArrayList<>();
    resultsByFile.forEach(
        (file, descriptors) -> {
          for (SubtitleDescriptor descriptor : descriptors) {
            String id = UUID.randomUUID().toString();
            descriptorCache.put(id, descriptor);
            dtos.add(
                new SubtitleDescriptorDto(
                    providerType,
                    id,
                    descriptor.getName(),
                    resolveLanguageCode(descriptor.getLanguageName(), request.language()),
                    resolveSubtitleFormat(descriptor.getType()),
                    1.0,
                    null,
                    file.getAbsolutePath()));
          }
        });
    return dtos;
  }

  @Override
  public SubtitleDownloadResultDto downloadSubtitles(List<SubtitleDownloadRequestDto> requests) {
    if (requests == null || requests.isEmpty()) {
      return new SubtitleDownloadResultDto(0, 0, Collections.emptyList());
    }

    int success = 0;
    int failure = 0;
    List<String> downloadedPaths = new ArrayList<>();

    for (SubtitleDownloadRequestDto req : requests) {
      if (req.videoFilePath() == null || req.subtitleId() == null) {
        failure++;
        continue;
      }

      SubtitleDescriptor descriptor = descriptorCache.get(req.subtitleId());
      if (descriptor == null) {
        failure++;
        continue;
      }

      try {
        MemoryFile subtitle = SubtitleUtilities.fetchSubtitle(descriptor);
        File video = new File(req.videoFilePath());
        String ext = req.targetFormat() != null ? req.targetFormat().name().toLowerCase() : "srt";
        String fileName = toLegacyNaming(req.namingStrategy()).format(video, descriptor, ext);
        File target = new File(video.getParentFile(), fileName);

        writeToFile(subtitle.getData(), target);
        downloadedPaths.add(target.getAbsolutePath());
        success++;
      } catch (Exception e) {
        failure++;
      }
    }

    return new SubtitleDownloadResultDto(success, failure, downloadedPaths);
  }

  @Override
  public void uploadSubtitle(SubtitleUploadRequestDto request) {
    // Uploading subtitles back to a provider (SubtitleUploadDialog in the legacy UI) has not
    // been ported yet - needs a product scope decision before building the upload modal and
    // wiring net.filebot.web.OpenSubtitlesClient's upload API (see
    // specs/DETAILED_IMPLEMENTATION_PLAN.md Phase 1.4).
  }

  private void writeToFile(ByteBuffer data, File target) throws Exception {
    try (FileOutputStream out = new FileOutputStream(target); FileChannel channel = out.getChannel()) {
      channel.write(data);
    }
  }

  private Locale resolveLocale(LanguageCode language) {
    if (language == null) {
      return Locale.ENGLISH;
    }
    Language resolved = Language.getLanguage(language.name());
    return resolved != null ? resolved.getLocale() : Locale.ENGLISH;
  }

  private LanguageCode resolveLanguageCode(String languageName, LanguageCode requested) {
    try {
      Language language = Language.findLanguage(languageName);
      if (language != null) {
        return LanguageCode.valueOf(language.getCode().toUpperCase());
      }
    } catch (Exception e) {
      // fall through to requested/default below
    }
    return requested != null ? requested : LanguageCode.EN;
  }

  private SubtitleNaming toLegacyNaming(net.filebot.backend.domain.SubtitleNamingStrategy strategy) {
    if (strategy == null) {
      return SubtitleNaming.MATCH_VIDEO_ADD_LANGUAGE_TAG;
    }
    return switch (strategy) {
      case ORIGINAL -> SubtitleNaming.ORIGINAL;
      case MATCH_VIDEO -> SubtitleNaming.MATCH_VIDEO;
      case MATCH_VIDEO_ADD_LANGUAGE_TAG -> SubtitleNaming.MATCH_VIDEO_ADD_LANGUAGE_TAG;
    };
  }

  private SubtitleFormat resolveSubtitleFormat(String type) {
    if (type == null) {
      return SubtitleFormat.SRT;
    }
    try {
      return SubtitleFormat.valueOf(type.toUpperCase());
    } catch (IllegalArgumentException e) {
      return SubtitleFormat.SRT;
    }
  }
}
