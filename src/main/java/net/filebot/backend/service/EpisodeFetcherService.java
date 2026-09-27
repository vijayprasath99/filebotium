package net.filebot.backend.service;

import java.util.List;
import net.filebot.backend.dto.EpisodeDto;
import net.filebot.backend.dto.EpisodeFetchRequestDto;
import net.filebot.backend.dto.SearchResultDto;
import net.filebot.backend.dto.SeriesSearchRequestDto;

public interface EpisodeFetcherService {
  List<SearchResultDto> searchSeries(SeriesSearchRequestDto request);

  List<EpisodeDto> getEpisodes(EpisodeFetchRequestDto request);

  List<String> getFormattedEpisodeList(EpisodeFetchRequestDto request, String formatExpression);
}
