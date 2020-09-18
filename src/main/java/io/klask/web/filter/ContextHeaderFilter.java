package io.klask.web.filter;

import java.io.IOException;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;

import org.slf4j.MDC;

import io.klask.config.JHipsterProperties;

/**
 * This filter is used in production, to put remote ip address in logs.
 */
public class ContextHeaderFilter implements Filter {

    public ContextHeaderFilter(JHipsterProperties jHipsterProperties) {
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
    }

    @Override
    public void destroy() {
        // Nothing to destroy
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
        throws IOException, ServletException {

        String contextInfo = request.getRemoteAddr();
//        if (userId != null) {
//            LOG.info("idcu found : {}", userId);
//            // Ajout dans le ThreadLocal
//            RestContext.setUserId(userId);
//            // Ajout des infos pour slf4J
//            contextInfo = contextInfo + " - " + userId;
//        }
        MDC.put("context.info", contextInfo);

        chain.doFilter(request, response);
    }
}
