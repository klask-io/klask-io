package io.klask.crawler.impl;

import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;

import java.util.concurrent.Future;

/**
 * Created by jeremie on 11/01/17.
 */
public class SVNCrawler implements ICrawler {

    @Override
    public Future<CrawlerResult> executeBulkIndex() {
        return null;
    }
}
