# Format Expression Engine Specification

**Status:** As-built. The evaluation engine itself is a thin, correct wrapper around legacy's
real Groovy-based expression format — it is not reimplemented. The one significant known gap
is the binding reference catalog, documented in §2.

Backend: `net.filebot.backend.controller.FormatController`,
`net.filebot.backend.service.FormatExpressionEngineServiceImpl`.
Frontend: `frontend/src/components/FormatEditorModal.tsx`, `EpisodeBindingsModal.tsx`
(consumed from the Rename workspace — see spec 02 §4).

---

## 1. Expression Evaluation

```
POST /api/v1/format/eval
Request:  FormatEvaluationRequestDto(expression: string, sampleFilePath: string?, sampleMetadata: Object?)
Response: FormatEvaluationResultDto(expression, result: string, isError: boolean,
                                     errorMessage: string?, executionTimeMs: long)
```

`FormatExpressionEngineServiceImpl.evaluateExpression` does exactly what it looks like:

```java
ExpressionFormat format = new ExpressionFormat(expression);
File file = filePath != null ? new File(filePath) : null;
MediaBindingBean bindingBean = new MediaBindingBean(metadataContext, file, null);
Object result = format.format(bindingBean);
```

`net.filebot.format.ExpressionFormat` and `net.filebot.format.MediaBindingBean` are legacy
classes used verbatim — the same Groovy-based expression engine legacy's Rename panel and CLI
use (`{n}`, `{s00e00}`, `{t}`, method-chain bindings like `{n.space('.').lower()}`, etc.). Any
exception during parsing or evaluation is caught and returned as
`isError=true, errorMessage=<exception message>` rather than propagating an HTTP error —
the frontend always gets a 200 response with a pass/fail flag baked in.

`batchEvaluate(expression, filePaths)` is a convenience loop calling `evaluateExpression` once
per path with `metadataContext = new File(path)` (i.e. no real matched metadata — evaluating
against the bare file, useful only for previewing filename-derived bindings like `{fn}`).
**No controller endpoint currently exposes `batchEvaluate`** — it exists on the service
interface but is unused. `RenameWorkspaceServiceImpl` has its own, separate
`evaluateFormat` helper (spec 02 §2.3) that binds against real matched `Episode`/`Movie`
objects; the two evaluation paths are intentionally not unified into one shared code path,
though both ultimately construct `ExpressionFormat` + `MediaBindingBean` the same way.

## 2. Binding Catalog — Known Gap

```
GET /api/v1/format/bindings?filePath={optional}
Response: BindingDocumentationDto[]   // { bindingKey, description, exampleValue, category }
```

```java
public record BindingDocumentationDto(
    String bindingKey, String description, String exampleValue, BindingCategory category)
// BindingCategory: GENERAL, VIDEO, AUDIO, SERIES, MOVIE
```

**`getAvailableBindings()` returns a hardcoded list of 8 entries** (`n`, `s00e00`, `t`, `y`,
`vf`, `vc`, `ac`, `group`) regardless of the `filePath`/`metadataContext` arguments passed in —
both parameters are accepted but never read. This is a known, **not yet fixed**, gap: legacy's
real `MediaBindingBean` exposes several dozen bindings (season/episode variants, audio/video
stream details, checksum, absolute numbering, per-provider IDs, etc.). A future contributor
wanting to close this should reflectively introspect `MediaBindingBean`'s public getters
(each `@Define("bindingName")`-annotated or conventionally-named getter corresponds to one
binding) rather than hand-maintaining this list — see legacy's `FormatDialog`/`BindingDialog`
resource bundles for the canonical reference catalog and example values, if one exists.
**This session did not attempt that fix**; treat the current 8-item list as the accurate
description of *what the API returns today*, not of what bindings actually work in an
expression (many more do — you can type `{airdate}`, `{vf}`, `{resolution}`, etc. into the
Format Editor and it will evaluate correctly via `evaluateExpression`; they just won't appear
in the reference table).

## 3. Syntax Validation

```
POST /api/v1/format/validate
Body: { "expression": string }  (or ?expression= query param — the controller accepts either)
Response: boolean
```

`validateExpressionSyntax` returns `true` iff `new ExpressionFormat(expression)` does not throw
— i.e. it validates *parse-ability*, not evaluate-ability against any particular file/metadata
(an expression can be syntactically valid and still throw at evaluation time against a
particular binding context, which is what `evaluateExpression`'s `isError` flag separately
reports).

## 4. Frontend Usage

`FormatEditorModal.tsx` debounces (200ms) calls to both `/format/validate` and `/format/eval`
on every keystroke, rendering a "✓ Valid Syntax" / "✗ Syntax Error" badge from the validate
call and a live preview string (or the error message) from the eval call. `sampleFilePath`/
`sampleMetadata` are never populated by this modal today — every live-preview evaluation runs
with `metadataContext = null, filePath = null`, so bindings that depend on file/metadata
context (e.g. `{vf}`, `{n}` when no series is bound) will not resolve meaningfully in this
preview; only string-literal and metadata-independent expressions preview accurately here.

`EpisodeBindingsModal.tsx` optionally lets the user pick a local "sample" file (via a hidden
`<input type=file>` + `getFilePath()`) and re-fetches `/format/bindings?filePath=...` when it
changes — but per §2, the backend ignores `filePath` entirely, so this control currently has no
observable effect on the returned binding list.

---

## 5. Known Gaps / Deliberately Deferred

- **Binding catalog is a hardcoded 8-item list**, not a reflective enumeration of
  `MediaBindingBean` (§2) — the single most significant gap in this area.
- **`batchEvaluate` has no REST endpoint** — dead code on the service interface.
- **No independent re-verification this session** of whether every binding legacy's Groovy
  engine supports evaluates correctly through this wrapper — `ExpressionFormat`/
  `MediaBindingBean` are used as-is (not modified), so behavior should match legacy for any
  binding that's actually exercised, but no exhaustive binding-by-binding test suite exists
  here (`FormatExpressionEngineServiceTest.java` covers only `getAvailableBindings`,
  `evaluateExpression`, and `validateExpressionSyntax` at a basic level).
- **Live preview in `FormatEditorModal` never binds to real sample metadata** — see §4.
