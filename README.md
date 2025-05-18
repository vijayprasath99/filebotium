This is fork of one of these repos (I forgot which one)
https://github.com/mobeigi/filebot
https://github.com/barry-allen07/FB-Mod

# Development

### Prereq

Java 17

### Build and Run
#### Run as Jar
```
./gradlew jar
cd build/libs
java -jar filebot-1.0-SNAPSHOT.jar
```

#### Build Mac Image
```
./gradlew runtime
./build/install/filebot/bin/filebot
```

#### Build Windows Image
```
.\gradlew.bat createExe 
```

#### In Idea
Import Project as a "JavaFx" Project.