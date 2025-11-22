module net.filebot {
    // Java Platform Modules
    requires java.base;
    requires java.desktop;
    requires java.logging;
    requires java.naming;
    requires java.prefs;
    requires java.scripting;
    requires java.sql;
    requires java.xml;
    requires java.compiler; // For javax.lang.model
    requires java.management; // For java.lang.management
    requires jdk.unsupported; // For sun.misc.Unsafe if needed

    // JavaFX Modules
    requires javafx.base;
    requires javafx.controls;
    requires javafx.fxml;
    requires javafx.graphics;
    requires javafx.swing;
    requires javafx.web;

    // Third-party Modules
    requires com.google.common; // Guava
    requires org.controlsfx.controls;
    requires org.kordamp.ikonli.javafx;
    requires org.kordamp.ikonli.core;
    requires org.kordamp.bootstrapfx.core;
    requires com.dlsc.formsfx;
    requires net.synedra.validatorfx;

    // JNA
    requires com.sun.jna;
    requires com.sun.jna.platform;

    // Caching
    requires ehcache;
    requires com.github.benmanes.caffeine;

    // Utilities
    requires org.jsoup;
    requires org.apache.commons.io;
    requires org.apache.commons.net;
    requires commons.vfs2;
    requires com.ibm.icu;
    requires one.util.streamex;

    // JAXB (XML Binding)
    requires jakarta.xml.bind;
    requires org.glassfish.jaxb.runtime;

    // JSON - Using automatic module names for older compatible versions
    requires json.io;

    // Logging
    requires org.slf4j;

    // UI Layout
    requires com.miglayout.swing;

    // Archive support - automatic module names
    requires junrar;
    requires sevenzipjbinding;
    requires sevenzipjbinding.all.platforms;

    // Text editing - automatic module names
    requires org.fife.RSyntaxTextArea;
    requires autocomplete;

    // Language detection
    requires language.detector;

    // Metadata extraction
    requires metadata.extractor;

    // BouncyCastle crypto
    requires org.bouncycastle.pg;
    requires org.bouncycastle.provider;

    // Image processing - automatic module name
    requires imgscalr.lib;

    // Groovy scripting
    requires org.apache.groovy;
    requires org.apache.groovy.jsr223;
    requires org.apache.groovy.ant;
    requires org.apache.groovy.json;
    requires org.apache.groovy.xml;
    requires org.apache.groovy.datetime;
    requires org.apache.groovy.templates;
    requires org.apache.groovy.nio;
    requires org.apache.groovy.swing;

    // Command-line argument parsing
    requires args4j;

    // XZ compression
    requires org.tukaani.xz;

    // Terminal UI
    requires com.googlecode.lanterna;

    // Bencode
    requires bencode;

    // XML-RPC
    requires xmlrpc;

    // macOS integration
    requires javaobjectivecbridge;

    // GlazedLists
    requires glazedlists;

    // Export main packages that may be accessed externally
    exports net.filebot;
    exports net.filebot.archive;
    exports net.filebot.cli;
    exports net.filebot.format;
    exports net.filebot.hash;
    exports net.filebot.media;
    exports net.filebot.mediainfo;
    exports net.filebot.platform.mac;
    exports net.filebot.platform.windows;
    exports net.filebot.platform.gnome;
    exports net.filebot.platform.bsd;
    exports net.filebot.similarity;
    exports net.filebot.subtitle;
    exports net.filebot.torrent;
    exports net.filebot.util;
    exports net.filebot.vfs;
    exports net.filebot.web;

    // Open packages for JavaFX FXML reflection
    opens net.filebot to javafx.fxml, javafx.graphics;
    opens net.filebot.ui to javafx.fxml, javafx.graphics, com.google.common;
    opens net.filebot.ui.rename to javafx.fxml, javafx.graphics, com.google.common;
    opens net.filebot.ui.episodelist to javafx.fxml, javafx.graphics, com.google.common;
    opens net.filebot.ui.subtitle to javafx.fxml, javafx.graphics, com.google.common;
    opens net.filebot.ui.filter to javafx.fxml, javafx.graphics, com.google.common;
    opens net.filebot.ui.list to javafx.fxml, javafx.graphics, com.google.common;
    opens net.filebot.ui.sfv to javafx.fxml, javafx.graphics, com.google.common;

    // Open packages for Groovy scripting reflection
    opens net.filebot.cli to org.apache.groovy, org.apache.groovy.jsr223;
    opens net.filebot.format to org.apache.groovy;

    // Open packages for JSON serialization/deserialization
    opens net.filebot.web to json.io;
    opens net.filebot.media to json.io;
}
