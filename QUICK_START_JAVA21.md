# Quick Start Guide - Java 21 & Native Packaging

## ✅ What's Been Upgraded

Your FileBot project has been successfully upgraded to **Java 21** with full **jpackage** support for creating native installers.

## 🚀 Quick Commands

### Build the Project
```bash
./gradlew clean build
```

### Run the Application
```bash
./gradlew run
```

### Create Native Application Image
```bash
./gradlew jpackageImage
```

Output: `build/jpackage/filebot/` (or `FileBot.app` on macOS)

### Create Native Installers

**Linux (Debian/Ubuntu):**
```bash
./gradlew jpackage -PinstallerType=deb
```

**Linux (RedHat/Fedora/CentOS):**
```bash
./gradlew jpackage -PinstallerType=rpm
```

**macOS:**
```bash
./gradlew jpackage -PinstallerType=dmg
```

**Windows:**
```cmd
gradlew.bat jpackage -PinstallerType=msi
```

## 📦 Where to Find Built Installers

All installers are created in: `build/jpackage/`

## 🔧 Prerequisites

### Required
- **JDK 21** (full JDK, not just JRE)
  - Download: https://adoptium.net/temurin/releases/?version=21

### Platform-Specific (for native installers)

**Linux:**
```bash
sudo apt-get update
sudo apt-get install -y fakeroot binutils rpm
```

**macOS:**
```bash
xcode-select --install
```

**Windows:**
- Install [WiX Toolset 3.11+](https://wixtoolset.org/)

## 🤖 GitHub Actions (CI/CD)

Every push automatically builds native installers for all platforms:
- Linux (`.deb` and `.rpm`)
- Windows (`.msi`)
- macOS (`.dmg`)

**Download pre-built installers:**
1. Go to: https://github.com/YOUR_USERNAME/filebot/actions
2. Click on a successful workflow run
3. Download artifacts for your platform

## 📚 Documentation

- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Detailed build and development guide
- **[UPGRADE_SUMMARY.md](UPGRADE_SUMMARY.md)** - Complete upgrade details
- **[README.md](README.md)** - Project overview and basic usage

## 🐛 Troubleshooting

### Gradle Daemon Issues
```bash
./gradlew --stop
```

### Verify Java Version
```bash
java -version      # Should show Java 21
javac -version     # Should show Java 21
jpackage --version # Should show version 21.x
```

### Set JAVA_HOME (if needed)
```bash
# Linux/macOS
export JAVA_HOME=/path/to/jdk-21

# Windows
set JAVA_HOME=C:\Path\To\jdk-21
```

## ✨ What Changed

1. **Java 21** - Upgraded from Java 17
2. **jpackage** - Fully configured for native installers
3. **GitHub Actions** - Cross-platform CI/CD workflow
4. **Documentation** - Comprehensive build guides

## 🎯 Next Steps

1. **Test locally:**
   ```bash
   ./gradlew jpackageImage
   ./build/jpackage/filebot/bin/filebot  # Linux
   ```

2. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Upgrade to Java 21 with jpackage support"
   git push
   ```

3. **Check GitHub Actions** to see automated builds

4. **Download installers** from GitHub Actions artifacts

---

**Need Help?** See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions.

