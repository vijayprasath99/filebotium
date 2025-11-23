# Contributing to FileBot

Thank you for your interest in contributing to FileBot! This guide will help you get started with development and building the project.

## Prerequisites

### Required Software

- **JDK 21**: FileBot requires Java Development Kit (JDK) 21 for compilation and native packaging
  - Download from [Adoptium (Eclipse Temurin)](https://adoptium.net/temurin/releases/?version=21)
  - **Important**: You need a full JDK installation, not just a JRE, to build native installers
- **Git**: For version control
- **Gradle**: Bundled via Gradle Wrapper (`./gradlew`)

### Platform-Specific Requirements for Native Packaging

#### Linux
For creating native Linux packages (`.deb`, `.rpm`), you need:
```bash
sudo apt-get update
sudo apt-get install -y fakeroot binutils rpm
```

#### macOS
For creating macOS installers (`.dmg`, `.pkg`), you need:
- Xcode Command Line Tools: `xcode-select --install`
- Valid Apple Developer ID (for code signing, optional for local builds)

#### Windows
For creating Windows installers (`.msi`, `.exe`), you need:
- [WiX Toolset](https://wixtoolset.org/) version 3.11+ (for MSI installers)
- [Inno Setup](https://jrsoftware.org/isinfo.php) (optional, for EXE installers)

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/filebot.git
cd filebot
```

### 2. Build the Project

```bash
./gradlew build
```

### 3. Run Tests

```bash
./gradlew test
```

### 4. Run the Application

#### As a JAR
```bash
./gradlew jar
cd build/libs
java -jar filebot-1.0-SNAPSHOT.jar
```

#### Using Gradle Application Plugin
```bash
./gradlew run
```

#### In IntelliJ IDEA
1. Import the project as a Gradle project
2. Configure the JDK to version 21 in Project Settings
3. Run the `Main` class directly

## Building Native Installers

FileBot uses `jpackage` (bundled with JDK 21) to create native installers for each platform. The build is configured using the [Badass JLink Plugin](https://badass-jlink-plugin.beryx.org/).

### Prerequisites for jpackage

**Critical**: `jpackage` requires a full JDK 21 installation. A JRE is not sufficient.

Verify your JDK installation:
```bash
java -version  # Should show Java 21
javac -version # Should show Java 21
jpackage --version # Should show version 21.x
```

### Build Commands

#### Create Application Image (All Platforms)

This creates a self-contained application directory with all dependencies:

```bash
./gradlew jpackageImage
```

The output will be in `build/jpackage/filebot/` (or `FileBot.app` on macOS).

#### Create Native Installers

##### Linux
```bash
# Debian package (.deb)
./gradlew jpackage -PinstallerType=deb

# RPM package (.rpm)
./gradlew jpackage -PinstallerType=rpm
```

##### macOS
```bash
# DMG image (.dmg)
./gradlew jpackage -PinstallerType=dmg

# PKG installer (.pkg)
./gradlew jpackage -PinstallerType=pkg
```

##### Windows
```bash
# MSI installer (.msi)
gradlew.bat jpackage -PinstallerType=msi

# EXE installer (.exe) - requires Inno Setup
gradlew.bat jpackage -PinstallerType=exe
```

#### Build All Formats

To build the app image only (recommended for testing):
```bash
./gradlew jpackageImage
```

### Output Location

Built installers and images will be located in:
```
build/jpackage/
├── filebot/              # App image (Linux/Windows)
├── FileBot.app/          # App image (macOS)
├── filebot-1.0.deb      # Debian package
├── filebot-1.0.rpm      # RPM package
├── FileBot-1.0.dmg      # macOS disk image
├── FileBot-1.0.pkg      # macOS installer package
├── FileBot-1.0.msi      # Windows MSI installer
└── FileBot-1.0.exe      # Windows EXE installer
```

## Code Style

This project uses [Spotless](https://github.com/diffplug/spotless) with Google Java Format for code formatting.

### Check Code Formatting
```bash
./gradlew spotlessCheck
```

### Apply Code Formatting
```bash
./gradlew spotlessApply
```

**Tip**: Set up your IDE to automatically format code on save using Google Java Format.

## Continuous Integration

The project uses GitHub Actions to automatically build native installers for all platforms (Linux, Windows, macOS) on every push.

You can find the workflow configuration in `.github/workflows/build-installers.yml`.

To download pre-built installers:
1. Go to the [Actions tab](https://github.com/YOUR_USERNAME/filebot/actions)
2. Click on a successful workflow run
3. Download the artifacts for your platform

## Common Issues

### Gradle Daemon Issues

If you encounter file locking or daemon issues, stop the Gradle daemon:
```bash
./gradlew --stop
```

### jpackage Not Found

Ensure you're using a full JDK 21 installation. Set `JAVA_HOME` explicitly if needed:
```bash
# Linux/macOS
export JAVA_HOME=/path/to/jdk-21
./gradlew jpackage

# Windows
set JAVA_HOME=C:\Path\To\jdk-21
gradlew.bat jpackage
```

### Missing Native Packaging Tools

- **Linux**: Install `fakeroot`, `binutils`, and `rpm` as mentioned in Prerequisites
- **Windows**: Install WiX Toolset and add it to your PATH
- **macOS**: Install Xcode Command Line Tools

### Module Path Issues

If you encounter module path errors, ensure:
1. You're using Java 21
2. The `module-info.java` is properly configured
3. All dependencies are modular or have automatic module names

## Submitting Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and commit: `git commit -am 'Add new feature'`
4. Apply code formatting: `./gradlew spotlessApply`
5. Run tests: `./gradlew test`
6. Push to your fork: `git push origin feature/my-feature`
7. Create a Pull Request

## Questions?

If you have any questions or need help, please open an issue on GitHub.

---

Thank you for contributing to FileBot! 🎉

