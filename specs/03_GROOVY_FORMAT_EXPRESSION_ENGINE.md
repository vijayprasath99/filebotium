# Groovy Format Expression Engine Specification

## Section A: Legacy Codebase Analysis

### Source Files Audited
- `src/main/java/net/filebot/format/ExpressionFormat.java`
- `src/main/java/net/filebot/format/MediaBindingBean.java`
- `src/main/java/net/filebot/format/ExpressionFormatFunctions.java`
- `src/main/java/net/filebot/format/ExpressionFormatMethods.java`
- `src/main/java/net/filebot/format/ExpressionBindings.java`
- `src/main/java/net/filebot/format/SecureCompiledScript.java`
- `src/main/java/net/filebot/ui/rename/FormatDialog.java`
- `src/main/java/net/filebot/ui/rename/BindingDialog.java`
- `src/main/java/net/filebot/ui/rename/FormatExpressionTextArea.java`
- `src/main/java/net/filebot/ui/rename/FormatExpressionTokenMaker.java`

### UI Hierarchy & Layout Mechanics
1. **Format Expression Dialog (`FormatDialog`)**:
   - Monospaced text editing component (`FormatExpressionTextArea`) with Groovy expression syntax highlighting (`FormatExpressionTokenMaker`).
   - Format Presets Dropdown (`Preset` list): Popular expressions for TV shows, movies, anime, and music.
   - Binding Explorer Launcher (`BindingDialog`): Modal popup displaying available dynamic bindings with sample evaluated values for selected media file.
   - Live Preview Table: Evaluates format expression in real-time as user types against sample media files in active workspace.

### Extracted Business Logic & Binding Catalog
1. **Compilation & Execution Model (`ExpressionFormat`)**:
   - Compiles format expressions using Groovy `GroovyShell` wrapped in security sandbox (`SecureCompiledScript`).
   - Expression strings like `{n} - {s00e00} - {t}` are parsed, replacing `{...}` closure tags into Groovy closure invocations.
2. **Binding Catalog (`MediaBindingBean`)**:
   - `n`: Primary Name / Series Title / Movie Title.
   - `s00e00`: Season & Episode formatted string (e.g. "S01E05").
   - `s`: Season number (`Integer`).
   - `e`: Episode number (`Integer`).
   - `t`: Episode Title / Subtitle.
   - `y`: Air Year / Release Year (`Integer`).
   - `vf`: Video Format / Resolution (e.g., "1080p", "2160p", "720p").
   - `vc`: Video Codec (e.g., "x264", "HEVC", "AV1").
   - `ac`: Audio Codec (e.g., "AAC", "AC3", "DTS", "FLAC").
   - `af`: Audio Channels / Format (e.g., "6ch", "2ch", "5.1").
   - `group`: Release group extracted from source filename.
   - `fn`: Original source Filename.
   - `ext`: Original file extension.
   - `crc32`: 8-character hex CRC32 checksum extracted from filename or file content.

---

## Section B: Target Spring Boot Backend Specification

### Service Interfaces & DTOs

```java
package net.filebot.backend.service;

import net.filebot.backend.dto.BindingDocumentationDto;
import net.filebot.backend.dto.FormatEvaluationResultDto;
import java.util.List;
import java.util.Map;

public interface FormatExpressionEngineService {
    FormatEvaluationResultDto evaluateExpression(String expression, Object metadataContext, String filePath);
    List<FormatEvaluationResultDto> batchEvaluate(String expression, List<String> filePaths);
    List<BindingDocumentationDto> getAvailableBindings(String filePath, Object metadataContext);
    boolean validateExpressionSyntax(String expression);
}

public enum BindingCategory {
    GENERAL, VIDEO, AUDIO, SERIES, MOVIE
}

public record FormatEvaluationRequestDto(
    String expression,
    String sampleFilePath,
    Object sampleMetadata
) {}

public record FormatEvaluationResultDto(
    String expression,
    String result,
    boolean isError,
    String errorMessage,
    long executionTimeMs
) {}

public record BindingDocumentationDto(
    String bindingKey,
    String description,
    String exampleValue,
    BindingCategory category
) {}
```

### REST Endpoints

#### 1. Evaluate Format Expression Endpoint
- **Method:** `POST`
- **Path:** `/api/v1/format/eval`
- **Request JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "expression": { "type": "string" },
    "sampleFilePath": { "type": "string" },
    "sampleMetadata": { "type": "object" }
  },
  "required": ["expression"]
}
```
- **Response JSON Schema:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "expression": { "type": "string" },
    "result": { "type": "string" },
    "isError": { "type": "boolean" },
    "errorMessage": { "type": "string" },
    "executionTimeMs": { "type": "number" }
  }
}
```

#### 2. Get Bindings Catalog Endpoint
- **Method:** `GET`
- **Path:** `/api/v1/format/bindings`
- **Response JSON Schema:** List of `BindingDocumentationDto` objects categorized by `GENERAL`, `VIDEO`, `AUDIO`, `SERIES`, `MOVIE`.

---

## Section C: Target React Frontend Specification

### Component Architecture

```
FormatEditorModal
├── EditorToolbar
│   ├── FormatPresetSelector
│   ├── BindingPickerToggle
│   └── SyntaxValidationBadge
├── GroovyCodeEditor (Monaco Editor / CodeMirror with Groovy syntax & completion)
├── BindingInspectorDrawer
│   └── BindingCategoryGroup
│       └── BindingRow (Key, Description, Live Evaluated Value)
└── LivePreviewTable
    └── PreviewRow (Sample File Path -> Evaluated Output Path)
```

### Props & State Types (TypeScript)

```typescript
export type BindingCategory = 'GENERAL' | 'VIDEO' | 'AUDIO' | 'SERIES' | 'MOVIE';

export interface FormatEditorProps {
  isOpen: boolean;
  initialExpression: string;
  onSave: (expression: string) => void;
  onClose: () => void;
  sampleFiles: MediaFile[];
}

export interface BindingDocumentation {
  bindingKey: string;
  description: string;
  exampleValue: string;
  category: BindingCategory;
}

export interface FormatEvaluationResult {
  expression: string;
  result: string;
  isError: boolean;
  errorMessage?: string;
  executionTimeMs: number;
}
```

---

## Section D: Dialogs, Modals & Edge Cases

1. **Groovy Sandbox Exception Alert:**
   - Displayed when user format expression throws a Groovy runtime exception (e.g. `NullPointerException`, missing method) or attempts restricted operations (file writing, system exec calls).
2. **Preset Manager Modal:**
   - Allows users to save, edit, and delete custom format expression presets stored in system preferences.
