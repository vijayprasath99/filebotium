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
│   │   │   ├── domain/                 # Domain Enums
│   │   │   ├── dto/                    # Java 17 DTO Records
│   │   │   ├── service/                # Headless @Service Wrappers
│   │   │   ├── controller/             # REST Controllers
│   │   │   └── websocket/              # STOMP WebSocket Config & Publisher
│   ├── test/java/net/filebot/backend/  # Integration & Unit tests
├── frontend/                           # React 18 + TypeScript + Tailwind SPA
├── desktop-wrapper/                    # Electron & Tauri desktop configurations
├── specs/                              # Architecture & Feature specifications
└── build.gradle                        # Gradle build configuration
```

---

## Local Development Setup

### 1. Spring Boot Backend Setup

The backend runs on **Java 21** using Spring Boot 3 and Gradle.

#### Running the Backend
To start the Spring Boot application locally:
```bash
./gradlew bootRun
```
*Alternatively, you can run:*
```bash
./gradlew run
```
The REST API server will be available at `http://localhost:8080/api`.

#### Running Tests
To run unit and integration tests:
```bash
./gradlew test
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

## 2. React 18 Frontend Setup

The frontend is located in the `frontend/` directory and built with **Vite, React 18, TypeScript, and Tailwind CSS**.

#### Installation & Development Server
```bash
# Navigate to the frontend directory
cd frontend

# Install Node modules
npm install

# Start the Vite development server with Hot Module Replacement (HMR)
npm run dev
```
The SPA will be accessible at `http://localhost:5173`. API requests are proxied or directed to `http://localhost:8080/api`.

#### Building the Frontend
To build static assets for production:
```bash
npm run build
```
Output files will be generated in `frontend/dist/`.

---

## 3. Desktop Wrapper (Electron & Tauri) Setup

Desktop packaging configurations reside in `desktop-wrapper/`.

#### Electron Setup
```bash
cd desktop-wrapper
npm install
npm run start
```

#### Tauri Setup
Ensure you have the Rust toolchain installed, then:
```bash
cd desktop-wrapper
cargo tauri dev
```

---

## 4. Building Production Packages

### Building JAR
```bash
./gradlew jar
```
The compiled output will be located in `build/libs/filebot-1.0-SNAPSHOT.jar`.

### Building Native Installers (jpackage)
```bash
# Create cross-platform app image
./gradlew jpackageImage

# Create platform-specific installer:
# Linux (.deb):
./gradlew jpackage -PinstallerType=deb

# macOS (.dmg):
./gradlew jpackage -PinstallerType=dmg

# Windows (.msi):
gradlew.bat jpackage -PinstallerType=msi
```

---

## Contribution Workflow

1. **Fork & Branch**: Create a feature branch off `main` (e.g., `feat/my-feature` or `fix/my-bug`).
2. **Write Code & Tests**: Ensure all new services or endpoints have corresponding unit or integration tests under `src/test/java/net/filebot/backend/`.
3. **Format Code**: Run `./gradlew spotlessApply` prior to committing.
4. **Run Verification**: Ensure `./gradlew spotlessCheck` and `./gradlew test` pass cleanly with 0 errors.
5. **Submit Pull Request**: Push your branch and open a PR with a concise description of your changes.
