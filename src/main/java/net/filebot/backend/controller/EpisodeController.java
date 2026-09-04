package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.dto.EpisodeDto;
import net.filebot.backend.dto.EpisodeFetchRequestDto;
import net.filebot.backend.dto.SearchResultDto;
import net.filebot.backend.dto.SeriesSearchRequestDto;
import net.filebot.backend.service.EpisodeFetcherService;

public class EpisodeController {

  private final EpisodeFetcherService episodeService;

  public EpisodeController(EpisodeFetcherService episodeService) {
    this.episodeService = episodeService;
  }

  public List<SearchResultDto> searchSeries(SeriesSearchRequestDto request) {
    return episodeService.searchSeries(request);
  }

  public List<EpisodeDto> getEpisodes(EpisodeFetchRequestDto request) {
    return episodeService.getEpisodes(request);
  }

  public List<String> getFormattedEpisodeList(
      EpisodeFetchRequestDto request, String formatExpression) {
    return episodeService.getFormattedEpisodeList(request, formatExpression);
  }
}
