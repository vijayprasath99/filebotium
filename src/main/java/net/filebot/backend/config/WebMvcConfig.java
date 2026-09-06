package net.filebot.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

  @Override
  public void addViewControllers(ViewControllerRegistry registry) {
    registry.addRedirectViewController("/", "/ui/");
    registry.addRedirectViewController("/ui", "/ui/");
    registry.addViewController("/ui/").setViewName("forward:/ui/index.html");
  }

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    registry
        .addResourceHandler("/ui/**")
        .addResourceLocations("classpath:/static/ui/")
        .resourceChain(true)
        .addResolver(new SpaPathResourceResolver());
  }
}
