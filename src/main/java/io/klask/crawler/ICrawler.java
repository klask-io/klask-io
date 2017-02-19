package io.klask.crawler;

import com.codahale.metrics.annotation.Timed;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.concurrent.Future;

/**
 * Created by jeremie on 11/01/17.
 */
public interface ICrawler {

    void setResult(Future<CrawlerResult> result);

    CrawlerResult start();

    Future<CrawlerResult> getResult();

    /**
     * stop the job
     */
    void stop();

    /**
     * return true if the job is still crawling
     * @return
     */
    boolean isCrawling();

    long getIndexedFiles();

    long getTotalFiles();
}
