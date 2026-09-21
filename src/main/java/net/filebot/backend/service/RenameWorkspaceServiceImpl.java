package net.filebot.backend.service;

import java.io.File;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import net.filebot.HistorySpooler;
import net.filebot.Language;
import net.filebot.StandardRenameAction;
import net.filebot.WebServices;
import net.filebot.backend.domain.FileAction;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.MatchStatus;
import net.filebot.backend.domain.MatchingMode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.MatchDto;
import net.filebot.backend.dto.MatchRequestDto;
import net.filebot.backend.dto.MediaFileDto;
import net.filebot.backend.dto.RenameErrorDto;
import net.filebot.backend.dto.RenameExecutionRequestDto;
import net.filebot.backend.dto.RenameExecutionResultDto;
import net.filebot.format.ExpressionFormat;
import net.filebot.format.MediaBindingBean;
import net.filebot.media.MediaDetection;
import net.filebot.similarity.EpisodeMatcher;
import net.filebot.similarity.Match;
import net.filebot.similarity.NameSimilarityMetric;
import net.filebot.util.FileUtilities;
import net.filebot.web.Episode;
import net.filebot.web.EpisodeListProvider;
import net.filebot.web.Movie;
import net.filebot.web.MovieIdentificationService;
import net.filebot.web.SearchResult;
import net.filebot.web.SortOrder;
import net.filebot.backend.websocket.TaskProgressPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class RenameWorkspaceServiceImpl implements RenameWorkspaceService {

  private final NameSimilarityMetric nameSimilarityMetric = new NameSimilarityMetric();
  private final TaskProgressPublisher progressPublisher;

  public RenameWorkspaceServiceImpl() {
    this(null);
  }

  @Autowired
  public RenameWorkspaceServiceImpl(TaskProgressPublisher progressPublisher) {
    this.progressPublisher = progressPublisher;
  }

  @Override
  public List<MatchDto> autoMatch(MatchRequestDto request) {
    if (request == null || request.filePaths() == null) {
      return Collections.emptyList();
    }

    List<File> files = request.filePaths().stream().map(File::new).collect(Collectors.toList());
    Locale locale = resolveLocale(request.language());
    MatchingMode mode = request.mode() != null ? request.mode() : MatchingMode.AUTO;

    Map<File, Object> metadataByFile = new HashMap<>();
    try {
      switch (mode) {
        case TV -> metadataByFile.putAll(matchEpisodes(files, request.provider(), locale, false));
        case ANIME -> metadataByFile.putAll(matchEpisodes(files, request.provider(), locale, true));
        case MOVIE -> metadataByFile.putAll(matchMovies(files, request.provider(), locale));
        case AUTO -> metadataByFile.putAll(matchAuto(files, request.provider(), locale));
        case MUSIC -> {
          // No headless, non-interactive music-identification path has been ported yet
          // (net.filebot.ui.rename.MusicMatcher's real logic is a follow-up item).
        }
      }
    } catch (Exception e) {
      // Provider/network failure: fall back to filename-only formatting for every file below.
    }

    List<MatchDto> matches = new ArrayList<>();
    for (File file : files) {
      MediaFileDto mediaFile = toMediaFileDto(file);
      Object metadata = metadataByFile.get(file);

      String formattedName = file.getName();
      if (request.formatExpression() != null && !request.formatExpression().isBlank()) {
        formattedName = evaluateFormat(request.formatExpression(), metadata, file, formattedName);
      }

      matches.add(
          new MatchDto(
              UUID.randomUUID().toString(),
              mediaFile,
              metadata,
              computeScore(file, metadata),
              formattedName,
              new File(file.getParentFile(), formattedName).getAbsolutePath(),
              false,
              metadata != null ? MatchStatus.MATCHED : MatchStatus.PENDING));
    }
    return matches;
  }

  private Map<File, Object> matchEpisodes(
      List<File> files, ProviderType providerType, Locale locale, boolean anime)
      throws Exception {
    EpisodeListProvider provider = resolveEpisodeProvider(providerType);
    List<File> mediaFiles =
        files.stream().filter(f -> !f.isDirectory()).collect(Collectors.toList());
    if (mediaFiles.isEmpty()) {
      return Collections.emptyMap();
    }

    List<String> queries = MediaDetection.detectSeriesNames(mediaFiles, anime, locale);
    if (queries.isEmpty()) {
      queries = List.of(FileUtilities.getName(mediaFiles.get(0)));
    }

    Set<Episode> episodePool = new LinkedHashSet<>();
    for (String query : queries) {
      List<SearchResult> options = provider.search(query, locale);
      if (!options.isEmpty()) {
        episodePool.addAll(provider.getEpisodeList(options.get(0), SortOrder.Airdate, locale));
      }
    }
    if (episodePool.isEmpty()) {
      return Collections.emptyMap();
    }

    EpisodeMatcher matcher = new EpisodeMatcher(mediaFiles, episodePool, false);
    List<Match<File, Object>> matched = matcher.match();

    Map<File, Object> result = new HashMap<>();
    for (Match<File, Object> m : matched) {
      result.put(m.getValue(), m.getCandidate());
    }
    return result;
  }

  private Map<File, Object> matchMovies(List<File> files, ProviderType providerType, Locale locale) {
    MovieIdentificationService service = resolveMovieProvider(providerType);
    Map<File, Object> result = new HashMap<>();
    for (File file : files) {
      if (file.isDirectory()) {
        continue;
      }
      try {
        List<Movie> options = MediaDetection.detectMovie(file, service, locale, false);
        if (!options.isEmpty()) {
          result.put(file, options.get(0));
        }
      } catch (Exception e) {
        // leave this file unmatched
      }
    }
    return result;
  }

  private Map<File, Object> matchAuto(List<File> files, ProviderType providerType, Locale locale)
      throws Exception {
    Map<File, Object> result = new HashMap<>(matchEpisodes(files, providerType, locale, false));

    List<File> unmatched =
        files.stream().filter(f -> !result.containsKey(f)).collect(Collectors.toList());
    if (!unmatched.isEmpty()) {
      result.putAll(matchMovies(unmatched, providerType, locale));
    }
    return result;
  }

  private EpisodeListProvider resolveEpisodeProvider(ProviderType type) {
    if (type == null) {
      return WebServices.TheTVDB;
    }
    return switch (type) {
      case THE_MOVIE_DB -> WebServices.TheMovieDB_TV;
      case ANI_DB -> WebServices.AniDB;
      case TV_MAZE -> WebServices.TVmaze;
      default -> WebServices.TheTVDB;
    };
  }

  private MovieIdentificationService resolveMovieProvider(ProviderType type) {
    if (type == ProviderType.OMDB) {
      return WebServices.OMDb;
    }
    return WebServices.TheMovieDB;
  }

  private Locale resolveLocale(LanguageCode language) {
    if (language == null) {
      return Locale.ENGLISH;
    }
    Language resolved = Language.getLanguage(language.name());
    return resolved != null ? resolved.getLocale() : Locale.ENGLISH;
  }

  private String evaluateFormat(
      String formatExpression, Object metadata, File file, String fallback) {
    try {
      ExpressionFormat format = new ExpressionFormat(formatExpression);
      MediaBindingBean bindingBean =
          new MediaBindingBean(metadata != null ? metadata : file, file, null);
      Object result = format.format(bindingBean);
      return result != null ? result.toString() : fallback;
    } catch (Exception e) {
      return fallback;
    }
  }

  private double computeScore(File file, Object metadata) {
    if (metadata == null) {
      return 0.0;
    }
    try {
      return nameSimilarityMetric.getSimilarity(FileUtilities.getName(file), metadata.toString());
    } catch (Exception e) {
      return 1.0;
    }
  }

  @Override
  public List<MatchDto> updateRowAlignment(
      List<MatchDto> currentMatches, int sourceIndex, int targetIndex) {
    if (currentMatches == null
        || sourceIndex < 0
        || targetIndex < 0
        || sourceIndex >= currentMatches.size()
        || targetIndex >= currentMatches.size()) {
      return currentMatches;
    }

    List<MatchDto> reordered = new ArrayList<>(currentMatches);
    MatchDto moved = reordered.remove(sourceIndex);
    reordered.add(targetIndex, moved);
    return reordered;
  }

  @Override
  public List<MatchDto> applyFormat(List<MatchDto> matches, String formatExpression) {
    if (matches == null || formatExpression == null) {
      return matches;
    }

    List<MatchDto> formattedMatches = new ArrayList<>();
    for (MatchDto match : matches) {
      if (match.isExcluded()) {
        formattedMatches.add(match);
        continue;
      }

      File file = new File(match.sourceFile().path());
      String newFormattedName =
          evaluateFormat(formatExpression, match.targetMetadata(), file, match.formattedName());

      File sourceFile = new File(match.sourceFile().path());
      File targetFile = new File(sourceFile.getParentFile(), newFormattedName);

      formattedMatches.add(
          new MatchDto(
              match.matchId(),
              match.sourceFile(),
              match.targetMetadata(),
              match.score(),
              newFormattedName,
              targetFile.getAbsolutePath(),
              match.isExcluded(),
              match.status()));
    }
    return formattedMatches;
  }

  @Override
  public RenameExecutionResultDto executeRename(RenameExecutionRequestDto request) {
    if (request == null || request.matches() == null) {
      return new RenameExecutionResultDto(
          UUID.randomUUID().toString(), 0, 0, Collections.emptyList());
    }

    int successCount = 0;
    int failureCount = 0;
    List<RenameErrorDto> errors = new ArrayList<>();
    String transactionId = UUID.randomUUID().toString();

    StandardRenameAction renameAction = StandardRenameAction.MOVE;
    if (request.action() == FileAction.COPY) {
      renameAction = StandardRenameAction.COPY;
    } else if (request.action() == FileAction.HARDLINK) {
      renameAction = StandardRenameAction.HARDLINK;
    } else if (request.action() == FileAction.SYMLINK) {
      renameAction = StandardRenameAction.SYMLINK;
    }

    List<MatchDto> activeMatches =
        request.matches().stream().filter(m -> !m.isExcluded()).toList();
    int total = activeMatches.size();
    int processed = 0;
    Map<File, File> historyBatch = new LinkedHashMap<>();

    for (MatchDto match : activeMatches) {
      processed++;
      try {
        File source = new File(match.sourceFile().path());
        File destination = new File(match.formattedPath());

        if (source.exists()) {
          renameAction.rename(source, destination);
          successCount++;
          if (renameAction.canRevert()) {
            historyBatch.put(source, destination);
          }
        } else {
          failureCount++;
          errors.add(
              new RenameErrorDto(
                  source.getAbsolutePath(),
                  destination.getAbsolutePath(),
                  "Source file does not exist"));
        }
      } catch (Exception e) {
        failureCount++;
        errors.add(
            new RenameErrorDto(match.sourceFile().path(), match.formattedPath(), e.getMessage()));
      }

      if (progressPublisher != null) {
        progressPublisher.publishRenameProgress(
            transactionId, processed, total, match.sourceFile().path(), 100.0 * processed / total);
      }
    }

    if (!historyBatch.isEmpty()) {
      HistorySpooler.getInstance().append(historyBatch);
    }

    return new RenameExecutionResultDto(transactionId, successCount, failureCount, errors);
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
