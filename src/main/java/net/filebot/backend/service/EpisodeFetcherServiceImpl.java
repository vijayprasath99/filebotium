package net.filebot.backend.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import net.filebot.backend.domain.EpisodeSortOrder;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.EpisodeDto;
import net.filebot.backend.dto.EpisodeFetchRequestDto;
import net.filebot.backend.dto.SearchResultDto;
import net.filebot.backend.dto.SeriesSearchRequestDto;
import net.filebot.format.ExpressionFormat;
import net.filebot.format.MediaBindingBean;
import net.filebot.web.AnidbClient;
import net.filebot.web.Episode;
import net.filebot.web.EpisodeListProvider;
import net.filebot.web.SearchResult;
import net.filebot.web.SortOrder;
import net.filebot.web.TMDbClient;
import net.filebot.web.TMDbTVClient;
import net.filebot.web.TVMazeClient;
import net.filebot.web.TheTVDBClient;

public class EpisodeFetcherServiceImpl implements EpisodeFetcherService {

  @Override
  public List<SearchResultDto> searchSeries(SeriesSearchRequestDto request) {
    if (request == null || request.query() == null || request.query().isBlank()) {
      return Collections.emptyList();
    }

    EpisodeListProvider provider = getProvider(request.provider());
    if (provider == null) {
      return Collections.emptyList();
    }

    try {
      List<SearchResult> results = provider.search(request.query(), Locale.ENGLISH);
      List<SearchResultDto> dtos = new ArrayList<>();
      for (SearchResult result : results) {
        dtos.add(
            new SearchResultDto(
                result.getId(),
                result.getName(),
                null,
                request.provider() != null ? request.provider() : ProviderType.THE_TVDB));
      }
      return dtos;
    } catch (Exception e) {
      return Collections.emptyList();
    }
  }

  @Override
  public List<EpisodeDto> getEpisodes(EpisodeFetchRequestDto request) {
    if (request == null) {
      return Collections.emptyList();
    }

    EpisodeListProvider provider = getProvider(request.provider());
    if (provider == null) {
      return Collections.emptyList();
    }

    try {
      SortOrder sortOrder = SortOrder.Airdate;
      if (request.sortOrder() == EpisodeSortOrder.ABSOLUTE) {
        sortOrder = SortOrder.Absolute;
      } else if (request.sortOrder() == EpisodeSortOrder.DVD) {
        sortOrder = SortOrder.DVD;
      }

      SearchResult searchResult =
          new SearchResult(request.seriesId(), "Series", Collections.emptyList());
      List<Episode> episodes = provider.getEpisodeList(searchResult, sortOrder, Locale.ENGLISH);

      List<EpisodeDto> dtos = new ArrayList<>();
      for (Episode ep : episodes) {
        if (request.seasonFilter() != null
            && ep.getSeason() != null
            && !request.seasonFilter().equals(ep.getSeason())) {
          continue;
        }

        dtos.add(
            new EpisodeDto(
                request.provider() != null ? request.provider() : ProviderType.THE_TVDB,
                ep.getSeriesName(),
                ep.getSeriesInfo() != null ? ep.getSeriesInfo().getId() : request.seriesId(),
                ep.getSeason(),
                ep.getEpisode(),
                ep.getAbsolute(),
                ep.getTitle(),
                ep.getAirdate() != null ? ep.getAirdate().toLocalDate() : null,
                request.language() != null ? request.language() : LanguageCode.EN,
                null));
      }
      return dtos;
    } catch (Exception e) {
      return Collections.emptyList();
    }
  }

  @Override
  public List<String> getFormattedEpisodeList(
      EpisodeFetchRequestDto request, String formatExpression) {
    List<EpisodeDto> episodes = getEpisodes(request);
    if (episodes.isEmpty() || formatExpression == null || formatExpression.isBlank()) {
      return Collections.emptyList();
    }

    List<String> formatted = new ArrayList<>();
    try {
      ExpressionFormat format = new ExpressionFormat(formatExpression);
      for (EpisodeDto dto : episodes) {
        Episode ep =
            new Episode(
                dto.seriesName(),
                dto.seasonNumber(),
                dto.episodeNumber(),
                dto.title(),
                dto.absoluteNumber(),
                null,
                null,
                null,
                null);
        MediaBindingBean bindingBean = new MediaBindingBean(ep, null, null);
        Object res = format.format(bindingBean);
        if (res != null) {
          formatted.add(res.toString());
        }
      }
    } catch (Exception e) {
      // Return empty on formatting error
    }
    return formatted;
  }

  private EpisodeListProvider getProvider(ProviderType type) {
    if (type == null) {
      return new TheTVDBClient("test-key");
    }
    return switch (type) {
      case THE_MOVIE_DB -> new TMDbTVClient(new TMDbClient("test-key", true));
      case ANI_DB -> new AnidbClient("filebot", 6);
      case TV_MAZE -> new TVMazeClient();
      default -> new TheTVDBClient("test-key");
    };
  }
}
