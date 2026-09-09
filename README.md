# FileBot

The ultimate TV and Movie Renamer / Subtitle Downloader / SFV Validator

This is fork of one of these repos (I forgot which one, if I think hard enough, it might come back to me):
- https://github.com/mobeigi/filebot
- https://github.com/barry-allen07/FB-Mod

> Please consider supporting the original developer if you appreciate this project. Be aware that the feature set is dated, and some functionality may not perform as intended. This repository is best suited for learning purposes or for private, non-production use.

## Requirements

- **Java 21** (JDK required for building, JRE sufficient for running)
- **Node.js 18+ & npm** (Required for building the React frontend during Gradle build)

## Download

### Pre-built Installers

Native installers for Windows, macOS, and Linux are available as GitHub Actions artifacts:

1. Go to the [Actions tab](https://github.com/YOUR_USERNAME/filebot/actions)
2. Click on the latest successful workflow run
3. Download the installer for your platform

### Building from Source

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed build instructions.

## Quick Start

### Running the Application

The build is unified: Gradle automatically compiles both the React frontend and Spring Boot backend.

#### Run with Gradle (Recommended)
```bash
# Automatically builds frontend and runs backend + UI
./gradlew bootRun
```
Once started, open your browser:
- **Web UI**: [http://localhost:8080/](http://localhost:8080/) (automatically redirects to `/ui/`)
- **REST APIs**: [http://localhost:8080/api/v1/app/status](http://localhost:8080/api/v1/app/status)
- **WebSocket (STOMP)**: `http://localhost:8080/api/ws` or `/ws`

#### Using Packaged JAR
```bash
# Builds frontend, runs tests, and packages static UI into the JAR:
./gradlew build

# Run the packaged JAR
java -jar build/libs/filebot-1.0-SNAPSHOT.jar
```

### Desktop Application (Electron)

Standard web browsers isolate the filesystem and do not permit reading absolute paths from dropped files. Testing inside Electron provides full operating system filesystem integration via `webUtils.getPathForFile`:

```bash
# Navigate to desktop-wrapper
cd desktop-wrapper
npm install

# Option A (Live Dev): If ./gradlew bootRun is already running, this attaches immediately:
npm run start

# Option B (Standalone): Spawn backend JAR automatically:
# (First run `./gradlew build` in repository root, then launch Electron):
npm run start

# Package desktop installer for current platform
npm run dist

# Cross-compile desktop installers for all platforms (Windows, macOS, Linux)
npm run dist:all
```

For more details, see [CONTRIBUTING.md](CONTRIBUTING.md#3-desktop-wrapper-electron-setup--local-testing).

## Development

### Prerequisites

- JDK 21
- Git
- Gradle (included via wrapper)

### IDE Setup

#### IntelliJ IDEA
1. Import the project as a Gradle project
2. Set Project SDK to Java 21
3. Run the `Main` class

### Building

```bash
# Build the project
./gradlew build

# Run tests
./gradlew test

# Format code
./gradlew spotlessApply
```

For detailed development and contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

See [LICENSE.md](LICENSE.md) for details.