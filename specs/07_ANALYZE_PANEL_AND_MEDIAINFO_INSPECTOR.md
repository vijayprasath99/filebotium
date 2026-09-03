# Analyze Panel & MediaInfo Inspector Specification

## Section A: Legacy Codebase Analysis

### Source Files Audited
- `src/main/java/net/filebot/ui/filter/FilterPanel.java`
- `src/main/java/net/filebot/ui/filter/FilterPanelBuilder.java`
- `src/main/java/net/filebot/ui/filter/FileTreePanel.java`
- `src/main/java/net/filebot/ui/filter/MediaInfoTool.java`
- `src/main/java/net/filebot/ui/filter/AttributeTool.java`
- `src/main/java/net/filebot/ui/filter/TypeTool.java`
- `src/main/java/net/filebot/ui/filter/ExtractTool.java`
- `src/main/java/net/filebot/ui/filter/SplitTool.java`
- `src/main/java/net/filebot/mediainfo/MediaInfo.java`
- `src/main/java/net/filebot/media/MediaCharacteristicsParser.java`

### UI Hierarchy & Layout Mechanics
1. **Analyze / Filter Panel Layout (`FilterPanel`)**:
   - File Tree Component (`FileTreePanel` / `FileTree`): Hierarchical tree representation of dropped folders and files.
   - Tool Palette: Sidebar buttons switching analysis tools:
     - `MediaInfoTool`: Displays detailed audio, video, container, and subtitle track stream technical metadata.
     - `AttributeTool`: Displays extended file attributes (`xattr`).
     - `TypeTool`: Groups files by media type (Video, Audio, Subtitle, Archive, Document).
     - `ExtractTool`: Archive unpacking utility (`ArchiveExtractor`).
     - `SplitTool`: File splitting and organization helper.
   - Filter / Search Bar: Real-time filtering of tree nodes by file name, extension, size, or metadata property.

### Extracted Business Logic & Native Media Inspection
1. **Native MediaInfo Bindings (`MediaInfo`)**:
   - Loads native JNA/JNI library `mediainfo.dll` / `libmediainfo.so` / `libmediainfo.dylib`.
   - Opens file stream and reads MediaInfo stream parameters:
     - General: Container format, Bitrate, Duration, Encoder.
     - Video: Codec ID, Width, Height, Aspect Ratio, Frame Rate, Bit Depth, Color Space, HDR Format (HDR10, Dolby Vision).
     - Audio: Codec ID, Channels, Sampling Rate, Language, Bitrate, Compression Mode.
     - Subtitle: Format, Language, Track Name, Default/Forced flags.

---

## Section B: Target Spring Boot Backend Specification

### Service Interfaces & DTOs

```java
package net.filebot.backend.service;

import net.filebot.backend.dto.MediaInfoInspectorDto;
import net.filebot.backend.dto.VideoStreamDto;
import net.filebot.backend.dto.AudioStreamDto;
import net.filebot.backend.dto.SubtitleStreamDto;
import java.util.List;

public interface MediaInfoInspectorService {
    MediaInfoInspectorDto inspectFile(String filePath);
    List<MediaInfoInspectorDto> batchInspect(List<String> filePaths);
}

public enum AnalysisTool {
    MEDIAINFO, XATTR, TYPES, EXTRACT, SPLIT
}

public enum StreamType {
    GENERAL, VIDEO, AUDIO, SUBTITLE
}

public record MediaInfoInspectorDto(
    String filePath,
    String containerFormat,
    long durationMs,
    long totalBitrate,
    List<VideoStreamDto> videoStreams,
    List<AudioStreamDto> audioStreams,
    List<SubtitleStreamDto> subtitleStreams
) {}

public record VideoStreamDto(
    int streamIndex,
    String codec,
    int width,
    int height,
    double frameRate,
    int bitDepth,
    String hdrFormat
) {}

public record AudioStreamDto(
    int streamIndex,
    String codec,
    int channels,
    int samplingRateHz,
    String language,
    long bitrate
) {}

public record SubtitleStreamDto(
    int streamIndex,
    String format,
    String language,
    boolean isDefault,
    boolean isForced
) {}
```

### REST Endpoints

#### 1. Inspect Single File Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/analyze/inspect`
- **Query Parameters:** `path` (string)
- **Response JSON Schema:** Standard `MediaInfoInspectorDto` fields.

#### 2. Batch Inspect Stream Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/analyze/batch-inspect`
- **Request JSON Schema:** List of file paths (`string[]`).

---

## Section C: Target React Frontend Specification

### Component Architecture

```
AnalyzePanel
├── FileTreeSidebar
│   ├── DirectoryTreeNodes
│   └── FileTypeFilterBar
├── ToolSelectorTabs (MediaInfo, Extended Attributes, File Types, Extractor)
└── InspectionDetailView
    ├── GeneralSummaryCard (Container, Duration, Bitrate)
    ├── VideoStreamsSection (Codec, Resolution, Aspect Ratio, HDR)
    ├── AudioStreamsSection (Codec, Channels, Language)
    └── SubtitleStreamsSection (Format, Language, Forced/Default)
```

### Props & State Types (TypeScript)

```typescript
export type AnalysisTool = 'MEDIAINFO' | 'XATTR' | 'TYPES' | 'EXTRACT' | 'SPLIT';
export type StreamType = 'GENERAL' | 'VIDEO' | 'AUDIO' | 'SUBTITLE';

export interface AnalyzePanelState {
  treeRoot: FileTreeNode;
  selectedFilePath: string | null;
  inspectionData: MediaInfoInspector | null;
  activeTool: AnalysisTool;
  isLoading: boolean;
}
```

---

## Section D: Dialogs, Modals & Edge Cases

1. **Missing Native MediaInfo Library Warning:**
   - Displays alert if `libmediainfo` is not installed or fail-over Java FFProbe parser is active.
2. **Batch Metadata Export Dialog:**
   - Export analyzed folder metadata to JSON or CSV.
