package net.filebot.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import net.filebot.backend.config.SpaPathResourceResolver;
import net.filebot.backend.config.WebMvcConfig;
import net.filebot.backend.websocket.WebSocketConfig;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.mock.web.MockServletContext;
import org.springframework.web.context.support.StaticWebApplicationContext;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;

public class WebMvcConfigTest {

  private final WebMvcConfig webMvcConfig = new WebMvcConfig();
  private final SpaPathResourceResolver resolver = new SpaPathResourceResolver();

  @Test
  public void testSpaResolverEmptyPathReturnsIndexHtml() throws IOException {
    Resource indexResource =
        new ByteArrayResource("<html>FileBot UI</html>".getBytes()) {
          @Override
          public String getFilename() {
            return "index.html";
          }

          @Override
          public boolean exists() {
            return true;
          }
        };

    Resource location =
        new ByteArrayResource(new byte[0]) {
          @Override
          public Resource createRelative(String relativePath) {
            if ("index.html".equals(relativePath)) {
              return indexResource;
            }
            return new ByteArrayResource(new byte[0]) {
              @Override
              public boolean exists() {
                return false;
              }
            };
          }
        };

    Resource result = resolver.getResource("", location);
    assertNotNull(result);
    assertSame(indexResource, result);

    Resource slashResult = resolver.getResource("/", location);
    assertNotNull(slashResult);
    assertSame(indexResource, slashResult);
  }

  @Test
  public void testSpaResolverExistingAssetReturnsAsset() throws IOException {
    Resource assetResource =
        new ByteArrayResource("console.log('filebot');".getBytes()) {
          @Override
          public String getFilename() {
            return "bundle.js";
          }

          @Override
          public boolean exists() {
            return true;
          }

          @Override
          public boolean isReadable() {
            return true;
          }
        };

    Resource location =
        new ByteArrayResource(new byte[0]) {
          @Override
          public Resource createRelative(String relativePath) {
            if ("assets/bundle.js".equals(relativePath)) {
              return assetResource;
            }
            return new ByteArrayResource(new byte[0]) {
              @Override
              public boolean exists() {
                return false;
              }
            };
          }
        };

    Resource result = resolver.getResource("assets/bundle.js", location);
    assertNotNull(result);
    assertSame(assetResource, result);
  }

  @Test
  public void testSpaResolverMissingFileWithExtensionReturnsNullFor404() throws IOException {
    Resource indexResource =
        new ByteArrayResource("<html>FileBot UI</html>".getBytes()) {
          @Override
          public boolean exists() {
            return true;
          }
        };

    Resource location =
        new ByteArrayResource(new byte[0]) {
          @Override
          public Resource createRelative(String relativePath) {
            if ("index.html".equals(relativePath)) {
              return indexResource;
            }
            return new ByteArrayResource(new byte[0]) {
              @Override
              public boolean exists() {
                return false;
              }
            };
          }
        };

    Resource result = resolver.getResource("assets/nonexistent.js", location);
    assertNull(result, "Missing file with extension should return null so Spring yields 404");

    Resource missingCss = resolver.getResource("styles/missing.css", location);
    assertNull(missingCss, "Missing CSS file should return null so Spring yields 404");
  }

  @Test
  public void testSpaResolverExtensionlessClientRouteReturnsIndexHtml() throws IOException {
    Resource indexResource =
        new ByteArrayResource("<html>FileBot UI</html>".getBytes()) {
          @Override
          public String getFilename() {
            return "index.html";
          }

          @Override
          public boolean exists() {
            return true;
          }

          @Override
          public boolean isReadable() {
            return true;
          }
        };

    Resource location =
        new ByteArrayResource(new byte[0]) {
          @Override
          public Resource createRelative(String relativePath) {
            if ("index.html".equals(relativePath)) {
              return indexResource;
            }
            return new ByteArrayResource(new byte[0]) {
              @Override
              public boolean exists() {
                return false;
              }
            };
          }
        };

    Resource renameRoute = resolver.getResource("rename", location);
    assertNotNull(renameRoute);
    assertSame(indexResource, renameRoute);

    Resource episodesRoute = resolver.getResource("episodes", location);
    assertNotNull(episodesRoute);
    assertSame(indexResource, episodesRoute);

    Resource nestedRoute = resolver.getResource("settings/general", location);
    assertNotNull(nestedRoute);
    assertSame(indexResource, nestedRoute);
  }

  @Test
  public void testWebMvcConfigRedirectsAndResourceHandlers() {
    StaticWebApplicationContext context = new StaticWebApplicationContext();
    context.setServletContext(new MockServletContext());
    context.refresh();

    ViewControllerRegistry viewRegistry = new ViewControllerRegistry(context);
    webMvcConfig.addViewControllers(viewRegistry);
    assertNotNull(viewRegistry);

    ResourceHandlerRegistry resourceRegistry =
        new ResourceHandlerRegistry(context, new MockServletContext());
    webMvcConfig.addResourceHandlers(resourceRegistry);
    assertTrue(resourceRegistry.hasMappingForPattern("/ui/**"));
  }

  @Test
  public void testWebSocketConfigEndpoints() {
    assertEquals("/ws", WebSocketConfig.WS_ENDPOINT);
    assertEquals("/api/ws", WebSocketConfig.API_WS_ENDPOINT);

    WebSocketConfig wsConfig = new WebSocketConfig();
    assertNotNull(wsConfig);
  }
}
