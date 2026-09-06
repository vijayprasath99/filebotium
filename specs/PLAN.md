# FileBot React UI Implementation Plan

## Executive Summary
This document provides a highly detailed, step-by-step execution plan tailored for a UI-focused agent (Gemini-Flash) to implement the React 18 + Tailwind CSS frontend for FileBot. 

**CRITICAL INSTRUCTION FOR UI AGENT:** For every component implemented, you MUST refer to the visual reference screenshots located in `specs/screenshot-ref/`. Your goal is to modernize the Swing UI into a web layout while precisely preserving the spatial arrangement, split views, iconography, and list layouts shown in the screenshots.

---

## Phase 1: Frontend Initialization & Scaffolding
**Target Directory:** `frontend/`

1. **Scaffold the App:**
   - Initialize a Vite + React + TypeScript project.
   - Install core dependencies: `tailwindcss`, `lucide-react` (for icons), `axios` (for API calls), `react-router-dom` (if routing is needed, otherwise state-based tab switching).
2. **Tailwind Configuration:**
   - Configure Tailwind to support the color palette seen in the reference images (blues for active states, red for errors, alternating row colors for tables).
3. **App Shell (`specs/01`):**
   - Implement the `AppShell` with a `SidebarNav` on the left.
   - Sidebar should contain vertical navigation buttons with icons: List, Rename, Analyze (Filter), Episodes, Subtitles, SFV.
   - The selected tab should be highlighted (e.g., blue background as seen in the screenshots).

---

## Phase 2: Component Implementation by Workspace

### Task 2.1: Rename Workspace & Format Editor
**Reference Images:** `1. Rename Panel.jpg`, `6. SFV Checksum Panel.jpg` (Format Editor)
**Spec Reference:** `specs/02_RENAME_WORKSPACE_AND_MATCHING_ENGINE.md`

1. **Rename Panel Layout:**
   - Build a dual-list layout (`MatchTableContainer`). 
   - Left side: "Original Files" list.
   - Right side: "New Names" list.
   - Center/Middle panel: "Match" and "Rename" action buttons with corresponding directional arrows.
2. **Bottom Toolbar:**
   - Implement Shift Up, Shift Down (arrow icons) for manual alignment.
   - Add "Load", "Fetch Data", and "Close" (X icon) buttons.
3. **Format Editor Modals:**
   - Implement "Episode Format" modal: Includes a text area for syntax highlighting and a syntax key with examples below it. Add "Cancel" (red icon) and "Use Format" (green icon) buttons.
   - Implement "Episode Bindings" modal: Inputs for Match Object, Media File, and a Preview table comparing Expression vs. Value.

### Task 2.2: Episodes Explorer Panel
**Reference Image:** `2. Episodes Panel.jpg`
**Spec Reference:** `specs/04_EPISODES_EXPLORER_AND_FETCHER.md`

1. **Top Search Bar:**
   - Search input (with TV icon).
   - "All Seasons" dropdown, "Airdate Order" dropdown, "English" language dropdown.
   - "Find" button with binoculars icon.
2. **Search Results Area:**
   - Implement tabs for Search Results (e.g., "History", "The Walking Dead").
   - Data Table: Show episodes with zebra-striped row styling (alternating white/light blue).
3. **Bottom Toolbar:**
   - Add a "Save as..." button with a notepad icon centered at the bottom.

### Task 2.3: Subtitles Panel & Downloader
**Reference Image:** `3. Subtitles Panel & Downloader.jpg`
**Spec Reference:** `specs/05_SUBTITLES_SEARCH_AND_DOWNLOADER.md`

1. **Split Match Grid:**
   - Left Column ("Video"): List of local video files.
   - Right Column ("Subtitle"): Expandable tree structure. Show folder icons for movies/series, and globe/download icons next to matched `.srt` files.
2. **Bottom Toolbar:**
   - Left side: "Exact Search" and "Fuzzy Search" buttons.
   - Right side: "Subtitle Naming" dropdown (e.g., "Match Video and Language"), "Download" button (green icon), and "Close" button (red icon).

### Task 2.4: Analyze (Filter) Panel
**Reference Image:** `4. Filter Analyze Panel.png`
**Spec Reference:** `specs/07_ANALYZE_PANEL_AND_MEDIAINFO_INSPECTOR.md`

1. **File Tree Sidebar:**
   - Left pane showing a hierarchical directory/file tree.
   - Add "Load" and "Clear" buttons at the bottom of the tree pane.
2. **Right Detail View & Tabs:**
   - Implement top tabs: "Archives", "Types", "Parts", "Attributes", "MediaInfo".
   - Under the "Types" tab, display a tree grouped by media type (Episode, Video, Audio) with file counts.
3. **Context Menu:**
   - Implement a right-click context menu with options: "Send to" (Rename, SFV, List), "Reveal", "Reveal Folder", "Expand all", "Collapse all".

---

## Phase 3: Visual Verification & Polish

**Verification Process for the UI Agent:**
For every component implemented above, execute the following verification checklist before marking the task complete:

1. **Structural Layout Match:** Does the React component have the exact same spatial arrangement (splits, columns, toolbars) as the reference screenshot?
2. **Iconography & Typography:** Are the Lucide icons correctly mapped to the legacy UI intents (e.g., Binoculars for find, Notepad for save)? Are button texts aligned correctly?
3. **Color & Styling:** Are zebra-striping, active tab highlights, and colored badges (green for download, red for close) implemented via Tailwind classes?
4. **Responsive Flexbox:** Do the central lists/tables stretch to fill available space while toolbars remain fixed at the top/bottom?
