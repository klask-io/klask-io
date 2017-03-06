package io.klask.crawler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * Created by harelj on 16/02/2017.
 */
@Component
public class AsyncCrawler {

    private final Logger log = LoggerFactory.getLogger(AsyncCrawler.class);

    @Async("taskExecutor")
    public void executeCrawler(ICrawler crawler){
//        Future<CrawlerResult> result = crawler.getResult();

//        if(result != null && !result.isDone() && !result.isCancelled() && result.){
//            log.warn("The crawler is yet indexing files... No more jobs can be submitted");
//        } else {
        //CrawlerResult crawlerResult = crawler.start();
        crawler.start();
//            crawler.setResult(new AsyncResult<>(crawlerResult));

//        }
//        return result;
    }
}
