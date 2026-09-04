package net.filebot.backend.service;

import java.io.File;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import net.filebot.backend.dto.AudioStreamDto;
import net.filebot.backend.dto.MediaInfoInspectorDto;
import net.filebot.backend.dto.SubtitleStreamDto;
import net.filebot.backend.dto.VideoStreamDto;
import net.filebot.mediainfo.MediaInfo;
import net.filebot.mediainfo.MediaInfo.StreamKind;
import org.springframework.stereotype.Service;

@Service
public class MediaInfoInspectorServiceImpl implements MediaInfoInspectorService {

  @Override
  public MediaInfoInspectorDto inspectFile(String filePath) {
    if (filePath == null || filePath.isBlank()) {
      return new MediaInfoInspectorDto("", "UNKNOWN", 0, 0, List.of(), List.of(), List.of());
    }

    File file = new File(filePath);
    if (!file.exists()) {
      return new MediaInfoInspectorDto(filePath, "UNKNOWN", 0, 0, List.of(), List.of(), List.of());
    }

    try (MediaInfo mi = new MediaInfo()) {
      mi.open(file);
      String container = mi.get(StreamKind.General, 0, "Codec/Extensions");
      if (container.isBlank()) {
        container = mi.get(StreamKind.General, 0, "Format");
      }

      long duration = 0;
      try {
        duration = (long) Double.parseDouble(mi.get(StreamKind.General, 0, "Duration"));
      } catch (Exception e) {
        // Fallback
      }

      long bitrate = 0;
      try {
        bitrate = (long) Double.parseDouble(mi.get(StreamKind.General, 0, "OverallBitRate"));
      } catch (Exception e) {
        // Fallback
      }

      List<VideoStreamDto> videoStreams = new ArrayList<>();
      int videoCount = mi.streamCount(StreamKind.Video);
      for (int i = 0; i < videoCount; i++) {
        String codec = mi.get(StreamKind.Video, i, "Format");
        int width = parseInteger(mi.get(StreamKind.Video, i, "Width"));
        int height = parseInteger(mi.get(StreamKind.Video, i, "Height"));
        double fps = parseDouble(mi.get(StreamKind.Video, i, "FrameRate"));
        int bitDepth = parseInteger(mi.get(StreamKind.Video, i, "BitDepth"));
        String hdr = mi.get(StreamKind.Video, i, "colour_primaries");

        videoStreams.add(new VideoStreamDto(i, codec, width, height, fps, bitDepth, hdr));
      }

      List<AudioStreamDto> audioStreams = new ArrayList<>();
      int audioCount = mi.streamCount(StreamKind.Audio);
      for (int i = 0; i < audioCount; i++) {
        String codec = mi.get(StreamKind.Audio, i, "Format");
        int channels = parseInteger(mi.get(StreamKind.Audio, i, "Channel(s)"));
        int samplingRate = parseInteger(mi.get(StreamKind.Audio, i, "SamplingRate"));
        String lang = mi.get(StreamKind.Audio, i, "Language");
        long streamBitrate = parseLong(mi.get(StreamKind.Audio, i, "BitRate"));

        audioStreams.add(new AudioStreamDto(i, codec, channels, samplingRate, lang, streamBitrate));
      }

      List<SubtitleStreamDto> subStreams = new ArrayList<>();
      int subCount = mi.streamCount(StreamKind.Text);
      for (int i = 0; i < subCount; i++) {
        String format = mi.get(StreamKind.Text, i, "Format");
        String lang = mi.get(StreamKind.Text, i, "Language");
        boolean isDefault = "Yes".equalsIgnoreCase(mi.get(StreamKind.Text, i, "Default"));
        boolean isForced = "Yes".equalsIgnoreCase(mi.get(StreamKind.Text, i, "Forced"));

        subStreams.add(new SubtitleStreamDto(i, format, lang, isDefault, isForced));
      }

      return new MediaInfoInspectorDto(
          filePath, container, duration, bitrate, videoStreams, audioStreams, subStreams);
    } catch (Exception e) {
      return new MediaInfoInspectorDto(filePath, "UNKNOWN", 0, 0, List.of(), List.of(), List.of());
    }
  }

  @Override
  public List<MediaInfoInspectorDto> batchInspect(List<String> filePaths) {
    if (filePaths == null || filePaths.isEmpty()) {
      return Collections.emptyList();
    }

    List<MediaInfoInspectorDto> results = new ArrayList<>();
    for (String path : filePaths) {
      results.add(inspectFile(path));
    }
    return results;
  }

  private int parseInteger(String val) {
    try {
      return Integer.parseInt(val.replaceAll("\\D+", ""));
    } catch (Exception e) {
      return 0;
    }
  }

  private long parseLong(String val) {
    try {
      return Long.parseLong(val.replaceAll("\\D+", ""));
    } catch (Exception e) {
      return 0L;
    }
  }

  private double parseDouble(String val) {
    try {
      return Double.parseDouble(val);
    } catch (Exception e) {
      return 0.0;
    }
  }
}
