package net.filebot.backend.controller;

import java.util.List;
import net.filebot.backend.domain.LanguageCode;
import net.filebot.backend.domain.ProviderType;
import net.filebot.backend.dto.EpisodeDto;
import net.filebot.backend.dto.EpisodeFetchRequestDto;
import net.filebot.backend.dto.SearchResultDto;
import net.filebot.backend.dto.SeriesSearchRequestDto;
import net.filebot.backend.service.EpisodeFetcherService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/episodes")
public class EpisodeController {

  private final EpisodeFetcherService episodeService;

  public EpisodeController(EpisodeFetcherService episodeService) {
    this.episodeService = episodeService;
  }

  @GetMapping("/search")
  public List<SearchResultDto> searchSeries(
      @RequestParam("query") String query,
      @RequestParam(value = "provider", defaultValue = "THE_TVDB") ProviderType provider,
      @RequestParam(value = "language", defaultValue = "EN") LanguageCode language) {
    return episodeService.searchSeries(new SeriesSearchRequestDto(query, provider, language));
  }

  @GetMapping("/series/{seriesId}")
  public List<EpisodeDto> getEpisodes(
      @PathVariable("seriesId") int seriesId,
      @RequestParam(value = "provider", defaultValue = "THE_TVDB") ProviderType provider) {
    return episodeService.getEpisodes(
        new EpisodeFetchRequestDto(seriesId, provider, null, LanguageCode.EN, null));
  }

  @GetMapping("/series/{seriesId}/format")
  public List<String> getFormattedEpisodeList(
      @PathVariable("seriesId") int seriesId, @RequestParam("expression") String formatExpression) {
    EpisodeFetchRequestDto req =
        new EpisodeFetchRequestDto(seriesId, ProviderType.THE_TVDB, null, LanguageCode.EN, null);
    return episodeService.getFormattedEpisodeList(req, formatExpression);
  }
}
