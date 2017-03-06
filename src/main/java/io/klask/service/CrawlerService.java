package io.klask.service;

import io.klask.config.KlaskProperties;
import io.klask.crawler.AsyncCrawler;
import io.klask.crawler.ICrawler;
import io.klask.crawler.impl.FileSystemCrawler;
import io.klask.crawler.impl.GitCrawler;
import io.klask.crawler.impl.SVNCrawler;
import io.klask.domain.File;
import io.klask.domain.Repository;
import io.klask.repository.RepositoryRepository;
import io.klask.repository.search.FileSearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.stereotype.Service;

import javax.inject.Inject;
import java.util.ArrayList;
import java.util.List;

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
    private RepositoryRepository repositoryRepository;

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
        for (Repository repo : repositoryRepository.findAll()) {
            ICrawler aCrawler;
            switch (repo.getType()) {
                case GIT:
                    aCrawler = new GitCrawler(repo);
                    break;
                case SVN:
                    aCrawler = new SVNCrawler(repo, klaskProperties, fileSearchRepository, elasticsearchTemplate);
                    break;
                case FILE_SYSTEM:
                default:
                    aCrawler = new FileSystemCrawler(repo.getPath(), klaskProperties, fileSearchRepository, elasticsearchTemplate);
                    break;

            }
            taskList.add(aCrawler);
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
