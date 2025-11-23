# FileBot

The ultimate TV and Movie Renamer / Subtitle Downloader / SFV Validator

This is fork of one of these repos (I forgot which one, if I think hard enough, it might come back to me):
- https://github.com/mobeigi/filebot
- https://github.com/barry-allen07/FB-Mod

> Please consider supporting the original developer if you appreciate this project. Be aware that the feature set is dated, and some functionality may not perform as intended. This repository is best suited for learning purposes or for private, non-production use.

## Requirements

- **Java 21** (JDK required for building, JRE sufficient for running)

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

#### Using Pre-built JAR
```bash
./gradlew jar
cd build/libs
java -jar filebot-1.0-SNAPSHOT.jar
```

#### Using Gradle
```bash
./gradlew run
```

### Building Native Installers

```bash
# Create application image (all platforms)
./gradlew jpackageImage

# Create platform-specific installer
# Linux: ./gradlew jpackage -PinstallerType=deb
# macOS: ./gradlew jpackage -PinstallerType=dmg
# Windows: gradlew.bat jpackage -PinstallerType=msi
```

For more details, see [CONTRIBUTING.md](CONTRIBUTING.md#building-native-installers).

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