package io.klask.crawler.impl;

import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.domain.Repository;

import java.util.concurrent.Future;

/**
 * Created by jeremie on 11/01/17.
 */
public class GitCrawler implements ICrawler {

    public GitCrawler(Repository repo) {
    }

    @Override
    public CrawlerResult start() {
        return null;
    }

    @Override
    public Future<CrawlerResult> getResult() {
        return null;
    }

    @Override
    public void setResult(Future<CrawlerResult> result) {

    }

    @Override
    public void stop() {}

    @Override
    public boolean isCrawling(){return false;}

    @Override
    public long getIndexedFiles(){return -1L;}

    @Override
    public long getTotalFiles() {
        return -1L;
    }
}
