package io.klask.crawler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Created by harelj on 16/02/2017.
 */
@Component
@Slf4j
public class AsyncCrawler {

    @Async("taskExecutor")
    public void executeCrawler(ICrawler crawler){
        log.debug("executeCrawer {}", crawler.getRepositoryId());
        crawler.start();
    }
}
