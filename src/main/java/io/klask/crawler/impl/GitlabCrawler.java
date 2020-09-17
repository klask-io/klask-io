package io.klask.crawler.impl;

import io.klask.config.KlaskProperties;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.domain.Repository;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;

import java.util.concurrent.Future;

public class GitlabCrawler extends GenericCrawler implements ICrawler {
    public GitlabCrawler(Repository repository, KlaskProperties klaskProperties, ElasticsearchTemplate elasticsearchTemplate) {
        super(repository, klaskProperties, elasticsearchTemplate);

    }

    @Override
    public void setResult(Future<CrawlerResult> result) {

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
    public void stop() {

    }

    @Override
    public boolean isCrawling() {
        return false;
    }

    @Override
    public long getIndexedFiles() {
        return 0;
    }

    @Override
    public long getTotalFiles() {
        return 0;
    }
}
