package net.filebot.backend.config;

import java.io.IOException;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.resource.PathResourceResolver;

public class SpaPathResourceResolver extends PathResourceResolver {

  @Override
  public Resource getResource(String resourcePath, Resource location) throws IOException {
    if (resourcePath == null || resourcePath.isEmpty() || resourcePath.equals("/")) {
      return location.createRelative("index.html");
    }
    Resource requestedResource = location.createRelative(resourcePath);
    if (requestedResource.exists() && requestedResource.isReadable()) {
      return requestedResource;
    }
    // If requesting a specific file with an extension that does not exist, return null (404)
    if (resourcePath.contains(".")) {
      return null;
    }
    // Otherwise fallback to SPA index.html for client-side routing
    Resource index = location.createRelative("index.html");
    return index.exists() && index.isReadable() ? index : null;
  }
}
