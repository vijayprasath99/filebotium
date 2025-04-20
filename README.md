# Development

### Prereq

```
% java --version
openjdk 11.0.24 2024-07-16
OpenJDK Runtime Environment Homebrew (build 11.0.24+0)
OpenJDK 64-Bit Server VM Homebrew (build 11.0.24+0, mixed mode)
```

### Build and Run
#### Run as Jar
```
./gradlew jar
cd build/libs
java -jar filebot-1.0-SNAPSHOT.jar

./gradlew runtime
./build/install/filebot/bin/filebot
```

#### In Idea
Import Project as a "JavaFx" Project.