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
AnalyzePanel (Legacy Name: Filter)
├── LeftSidebar
│   ├── FileTree (Hierarchical Directory/File Nodes)
│   └── BottomControls (Load button, Clear button)
├── ToolSelectorTabs (Archives | Types | Parts | Attributes | MediaInfo)
└── RightDetailView
    ├── TypesTreeSection (e.g., Episode, Video, Audio grouped by type with counts)
    ├── ContextMenu (Send to -> Rename/SFV/List, Reveal, Reveal Folder, Expand all)
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

---

## AUDIT ADDENDUM (2026-09-19) — DO NOT SILENTLY OVERWRITE ORIGINAL CONTENT ABOVE

Full detail: `specs/audit/07_analyze_audit.md`. The MediaInfo tab itself is genuinely
well-implemented (real native `libmediainfo` JNA binding, not a stub — confirmed via
`build.gradle`'s `jna`/`jna-platform` dependencies); the other four tool tabs are not.

- **AN-1/AN-2/AN-3/AN-4 (BROKEN_FUNCTIONALITY):** the "Archives", "Parts",
  "Attributes", and "Types" tabs are **entirely client-side facades with zero
  backend method behind any of them** — `MediaInfoInspectorService` (the only
  Analyze-domain service) has no archive-listing, split/bin-packing, xattr, or
  content-classification method at all. Each tab instead does a shallow
  regex/string operation on the filename (e.g. "Types" groups by extension string
  with a fake `size` field that is literally the text `"N file(s)"`, not a byte
  count). **New requirement:** these are real, separate backend capabilities that
  need to be built, not wired — see reuse targets below.
- **AN-5 (BROKEN_FUNCTIONALITY):** "Reveal"/"Reveal Folder" context menu items are
  fully dangling no-ops (only show a text banner); no Electron IPC bridge for
  OS-file-manager integration exists in `desktop-wrapper/preload.js` (only
  `getPath` is exposed) — a new IPC channel is required to make this possible at
  all.
- **AN-8/AN-9 (DATA_INTEGRITY_RISK):** `MediaInfoInspectorServiceImpl` reads the
  wrong MediaInfo key for HDR detection (`colour_primaries` instead of
  `HDR_Format`/`HDR_Format_Compatibility`), producing spurious HDR badges on
  ordinary wide-gamut SDR content; and the purpose-built `MediaInfoException`
  (native-library-missing diagnostic) is swallowed by a generic `catch(Exception e)`
  before it can surface §D's "Missing Native Library Warning" to the user.
- **AN-12 (BROKEN_FUNCTIONALITY, compounds specs/01/08's List/History
  mislabeling):** "Send to → List" correctly computes the target files and calls
  `onNavigateTab('LIST', files)`, but `AppShell.tsx` renders `HistoryPanel` (which
  accepts no `files` prop) for the `'LIST'` tab — the files are silently discarded.
- **§A "Filter / Search Bar" — spec correction, not an implementation gap:** no
  such control exists anywhere in the legacy `FilterPanel`/`FileTreePanel`/`FileTree`
  source; both the spec and the implementation's shared absence of it is not a
  defect.
- **New requirement — primary reuse targets:** `net.filebot.archive.{Archive,
  FileMapper}` for AN-1; the bin-packing loop in `SplitTool.createModelInBackground`
  for AN-2 (plain `File`/`long` arithmetic, portable verbatim);
  `net.filebot.media.{XattrMetaInfo,MetaAttributes}`/`net.filebot.MetaAttributeView`
  for AN-3; `net.filebot.media.MediaDetection.{isMovie,isEpisode,
  getDiskFolderFilter,getClutterFileFilter}` for AN-4.
- Full gap table (AN-1 through AN-13) is in the audit file.
