# AGENTS.md

Welcome to the **FileBot Architecture Migration** repository. This document provides clear guidelines, architectural standards, build instructions, and testing rules for AI agents and human contributors working on this project.

---

## 1. Project Overview & Architecture

This repository is a decoupled, modernized fork of **FileBot**. It converts the legacy Java Swing desktop application into a modern headless Spring Boot 3 backend paired with a React 18 TypeScript frontend SPA, which can be packaged into cross-platform desktop installers via Electron or Tauri.

### Core Stack
- **Backend**: Java 21, Spring Boot 3.3.5, Spring WebSocket (STOMP over SockJS), Gradle 8.11 (Java Module System / JPMS enabled).
- **Frontend**: Vite, React 18, TypeScript, Tailwind CSS, Lucide Icons, Axios.
- **Desktop Wrappers**: Electron (`desktop-wrapper/main.js`), Tauri (`desktop-wrapper/tauri.conf.json`).
- **Specifications**: Architectural and feature specification documents are maintained in `specs/`.

---

## 2. Directory Layout & Module Structure

- `src/main/java/net/filebot/`: Legacy FileBot domain logic, Swing components, format engines, scrapers, and checksum utilities.
- `src/main/java/net/filebot/backend/`: Spring Boot 3 Application code:
  - `domain/`: Strongly-typed Java enums (`ProviderType`, `FileAction`, `MatchingMode`, `HashType`, etc.).
  - `dto/`: Java 17 record DTOs used across REST and WebSocket APIs.
  - `service/`: Headless `@Service` implementation wrappers around FileBot's domain logic.
  - `controller/`: `@RestController` classes exposing REST endpoints.
  - `websocket/`: `@EnableWebSocketMessageBroker` configuration and STOMP progress publisher.
- `src/test/java/net/filebot/backend/`: Unit and integration test suites.
- `frontend/`: React 18 + TypeScript + Tailwind CSS Single Page Application.
- `desktop-wrapper/`: Desktop launcher configurations for Electron and Tauri sidecar packaging.
- `specs/`: Detailed markdown specifications (`00_SYSTEM_ARCHITECTURE_AND_MODELS.md` through `10_CROSS_PLATFORM_PACKAGING_GUIDE.md` and `PLAN.md`).

---

## 3. Important Development Rules & Coding Standards

1. **Java Module System (JPMS)**:
   - Module descriptor is located at `src/main/java/module-info.java`.
   - When introducing new packages under `net.filebot.backend`, ensure they are exported (`exports ...;`) and opened to Spring (`opens ... to spring.core, spring.beans, spring.context;`).

2. **Code Formatting (Spotless)**:
   - Java code formatting is enforced via **Spotless** and **Google Java Format**.
   - Always run `./gradlew spotlessApply` before committing changes.
   - Verify formatting with `./gradlew spotlessCheck`.

3. **Type Safety & Domain Enums**:
   - Use strongly-typed Java enums in `net.filebot.backend.domain` for status fields, provider types, and modes instead of raw strings.
   - Mirror these types in `frontend/src/types/index.ts` using TypeScript discriminated unions or string literal enums.

4. **Testing Rules**:
   - All backend changes must pass tests run via `./gradlew test`.
   - Unit tests for services and integration tests for controllers belong in `src/test/java/net/filebot/backend/`.

---

## 4. Useful Commands

### Backend Commands
```bash
# Build the project
./gradlew build

# Run Spring Boot backend locally
./gradlew bootRun

# Run unit and integration tests
./gradlew test

# Check code formatting compliance
./gradlew spotlessCheck

# Apply code formatting fixes
./gradlew spotlessApply
```

### Frontend Commands
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev

# Build production SPA assets
npm run build
```

---

## 5. Verification Checklist Before Committing

Before submitting or completing a task, always verify:
1. `./gradlew spotlessApply` has been executed to format Java code.
2. `./gradlew spotlessCheck` passes cleanly.
3. `./gradlew test` executes with 100% test success rate.
4. `module-info.java` properly exports any new backend packages.
