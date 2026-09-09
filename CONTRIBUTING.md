# Contributing to FileBot

Thank you for your interest in contributing to FileBot! This document provides instructions for setting up your local environment, running, testing, and building both the Spring Boot 3 backend and the React 18 frontend.

---

## Prerequisites

Before getting started, ensure you have the following installed:

- **Java Development Kit (JDK) 21**: Required for building and running the backend.
- **Node.js (v18 or higher) & npm**: Required for running and building the React 18 SPA frontend.
- **Git**: For version control.

---

## Project Structure Overview

```
filebotium/
├── src/
│   ├── main/java/net/filebot/          # Legacy Swing & Domain logic
│   │   ├── backend/                    # Spring Boot 3 Backend
│   │   │   ├── config/                 # WebMvc & SPA Resource Routing (/ui)
│   │   │   ├── domain/                 # Domain Enums
│   │   │   ├── dto/                    # Java 17 DTO Records
│   │   │   ├── service/                # Headless @Service Wrappers
│   │   │   ├── controller/             # REST Controllers (/api/)
│   │   │   └── websocket/              # STOMP WebSocket Config & Publisher (/ws, /api/ws)
│   ├── test/java/net/filebot/backend/  # Integration & Unit tests
├── frontend/                           # React 18 + TypeScript + Tailwind SPA
├── desktop-wrapper/                    # Electron desktop configuration and packaging
├── specs/                              # Architecture & Feature specifications
└── build.gradle                        # Gradle build configuration
```

---

## Local Development Setup

### 1. Spring Boot Backend & Unified Application

The backend runs on **Java 21** using Spring Boot 3 and Gradle. The Gradle build automatically handles building the React frontend.

#### Running the Unified Application
To start the application locally:
```bash
./gradlew bootRun
```
This task automatically:
1. Installs frontend npm packages (`npmInstall`) if needed.
2. Compiles the React SPA (`buildFrontend`) into `frontend/dist`.
3. Copies static assets into backend resources (`static/ui`).
4. Boots the Spring Boot server on `http://localhost:8080/`.

Once running:
- **Web UI**: Access [http://localhost:8080/](http://localhost:8080/) or [http://localhost:8080/ui/](http://localhost:8080/ui/). Root `/` and `/ui` automatically redirect to `/ui/`, and client-side SPA routes fallback to `index.html`.
- **REST APIs**: All REST endpoints are served under `/api/` (e.g. `http://localhost:8080/api/v1/app/status`).
- **WebSocket (STOMP)**: Endpoints registered at `/api/ws` and `/ws`.

#### Running Tests
To run unit and integration tests:
```bash
./gradlew test

# Or skip frontend rebuilding during rapid backend test iterations:
./gradlew test -PskipFrontend
```

#### Code Formatting & Style
Code formatting is enforced using Spotless and Google Java Format.
```bash
# Check code formatting compliance
./gradlew spotlessCheck

# Automatically format Java code
./gradlew spotlessApply
```

---

## 2. React 18 Frontend (Standalone Dev Mode)

The frontend is located in `frontend/` and built with **Vite, React 18, TypeScript, and Tailwind CSS**. While Gradle handles production builds automatically, you can also run Vite's standalone dev server with Hot Module Replacement (HMR).

#### Installation & Development Server
```bash
# Navigate to the frontend directory
cd frontend

# Install Node modules
npm install

# Start the Vite development server with HMR
npm run dev
```
The standalone SPA runs at `http://localhost:5173/ui/`. Requests to `/api` and `/ws` are proxied to the backend at `http://localhost:8080`.

---

## 3. Desktop Wrapper (Electron) Setup & Local Testing

### Why Test with Electron?
When accessing FileBot through standard browsers (like Chrome), the web browser security sandbox restricts access to local file paths, supplying only stripped filenames (e.g. `movie.mkv` instead of `C:\Users\...\movie.mkv`). Testing inside Electron provides full operating system access using `webUtils.getPathForFile` via `desktop-wrapper/preload.js`.

### Local Testing Options

#### Option A: Live Dev Mode (Recommended for Rapid Development)
If your Spring Boot backend is already running (e.g. via `./gradlew bootRun`):
```bash
cd desktop-wrapper
npm install   # (first time only)
npm run start
```
*Electron will automatically detect the running backend on port 8080 and immediately open the native desktop window.*

#### Option B: Standalone Mode (Full Package Lifecycle)
To test Electron spawning and managing the Spring Boot backend JAR:
```bash
# 1. In repository root, compile the JAR:
./gradlew build

# 2. In desktop-wrapper, launch Electron:
cd desktop-wrapper
npm run start
```
*Electron will find `build/libs/filebot-1.0-SNAPSHOT.jar`, launch it as a child process, and open the desktop window once the backend is healthy.*

---

## 4. Building Production Packages

### Step 1: Build Unified Backend JAR with Bundled UI
```bash
# In repository root
./gradlew build
```
Gradle automatically builds the frontend (`npm run build`), runs all tests, and packages both the Spring Boot backend and static UI into `build/libs/filebot-1.0-SNAPSHOT.jar`.

### Step 2: Package Desktop Application (Electron)
```bash
cd desktop-wrapper

# Build installer for current operating system:
npm run dist

# Cross-compile installers for all platforms (Windows, macOS, Linux):
npm run dist:all

# Or build platform-specific targets individually:
npm run dist:win      # Windows (.exe installer & portable)
npm run dist:mac      # macOS (.dmg & .zip)
npm run dist:linux    # Linux (.AppImage & .deb)
```

---

## Contribution Workflow

1. **Fork & Branch**: Create a feature branch off `main` (e.g., `feat/my-feature` or `fix/my-bug`).
2. **Write Code & Tests**: Ensure all new services or endpoints have corresponding unit or integration tests under `src/test/java/net/filebot/backend/`.
3. **Format Code**: Run `./gradlew spotlessApply` prior to committing.
4. **Run Verification**: Ensure `./gradlew spotlessCheck` and `./gradlew test` pass cleanly with 0 errors.
5. **Submit Pull Request**: Push your branch and open a PR with a concise description of your changes.
