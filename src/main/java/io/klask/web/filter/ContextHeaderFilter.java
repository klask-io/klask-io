package io.klask.web.filter;

import io.klask.config.JHipsterProperties;
import org.slf4j.MDC;

import javax.servlet.*;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * This filter is used in production, to put remote ip address in logs.
 */
public class ContextHeaderFilter implements Filter {

    // We consider the last modified date is the start up time of the server
    private final static long LAST_MODIFIED = System.currentTimeMillis();

    private long CACHE_TIME_TO_LIVE = TimeUnit.DAYS.toMillis(1461L);

    private JHipsterProperties jHipsterProperties;

    public ContextHeaderFilter(JHipsterProperties jHipsterProperties) {
        this.jHipsterProperties = jHipsterProperties;
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        CACHE_TIME_TO_LIVE = TimeUnit.DAYS.toMillis(jHipsterProperties.getHttp().getCache().getTimeToLiveInDays());
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
