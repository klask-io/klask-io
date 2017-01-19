package fr.dlap.research.crawler;

import org.springframework.scheduling.annotation.Async;

import java.util.concurrent.Future;

/**
 * Created by jeremie on 11/01/17.
 */
public interface ICrawler {

    @Async
    Future<CrawlerResult> executeBulkIndex();
}
