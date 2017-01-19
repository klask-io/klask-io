package fr.dlap.research.crawler.impl;

import fr.dlap.research.crawler.CrawlerResult;
import fr.dlap.research.crawler.ICrawler;

import java.util.concurrent.Future;

/**
 * Created by jeremie on 11/01/17.
 */
public class GitCrawler implements ICrawler {

    @Override
    public Future<CrawlerResult> executeBulkIndex() {
        return null;
    }
}
