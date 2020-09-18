package io.klask.crawler;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Created by harelj on 16/02/2017.
 */
@Component
public class AsyncCrawler {

    @Async("taskExecutor")
    public void executeCrawler(ICrawler crawler){
        crawler.start();
    }
}
