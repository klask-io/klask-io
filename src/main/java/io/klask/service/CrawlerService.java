package io.klask.service;

import com.codahale.metrics.annotation.Timed;
import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.crawler.AsyncCrawler;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.crawler.impl.FileSystemCrawler;
import io.klask.domain.File;
import io.klask.repository.search.FileSearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.ElasticsearchException;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.stereotype.Service;

import javax.inject.Inject;
import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.Future;

/**
 * Created by jeremie on 30/04/16.
 */
@Service
public class CrawlerService {

    private final Logger log = LoggerFactory.getLogger(CrawlerService.class);


    private List<ICrawler> taskList = new ArrayList<>();

    @Inject
    private ElasticsearchTemplate elasticsearchTemplate;

    @Inject
    private KlaskProperties klaskProperties;

    @Inject
    private FileSearchRepository fileSearchRepository;

    @Inject
    private AsyncCrawler asyncCrawler;


    /**
     * clear all the index
     */
    public void clearIndex() {
        elasticsearchTemplate.deleteIndex(File.class);
        elasticsearchTemplate.createIndex(File.class);
        elasticsearchTemplate.putMapping(File.class);
        elasticsearchTemplate.refresh(File.class);
    }

    /**
     * reload the list of repositories
     */
    public void resetAllRepo() {
        taskList.clear();
        //TODO : for now, we just use a fileSystem crawler
        for (String directory : klaskProperties.getCrawler().getDirectoriesToScan()){
            taskList.add(new FileSystemCrawler(directory,klaskProperties,fileSearchRepository, elasticsearchTemplate));
        }

    }

    /**
     * execute bulk index on all declared crawlers
     */
    public void crawlerAllRepo() {

        for (ICrawler job : taskList){
            asyncCrawler.executeCrawler(job);
        }
    }

    public boolean isCrawling() {
        boolean isCrawling=false;
        for (ICrawler job : this.taskList){
            isCrawling|= job.isCrawling();
            log.debug("{} indexed files...", job.getIndexedFiles());
        }
        return isCrawling;
    }

    public void cancelAllRepositories() {
        for(ICrawler job: this.taskList){
            job.stop();
        }
    }
}
