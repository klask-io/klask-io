package io.klask.service;

import java.util.ArrayList;
import java.util.List;

import javax.annotation.PostConstruct;
import javax.inject.Inject;

import io.klask.config.SchedulerConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.stereotype.Service;

import io.klask.config.KlaskProperties;
import io.klask.crawler.AsyncCrawler;
import io.klask.crawler.ICrawler;
import io.klask.crawler.impl.FileSystemCrawler;
import io.klask.crawler.impl.GitCrawler;
import io.klask.crawler.impl.GitlabCrawler;
import io.klask.crawler.impl.SVNCrawler;
import io.klask.domain.File;
import io.klask.domain.Repository;
import io.klask.repository.RepositoryRepository;
import io.klask.repository.search.FileSearchRepository;

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

    @Inject
    private SchedulerConfig schedulerConfig;


    /**
     * clear all the index
     */
    public void clearIndex() {
        elasticsearchTemplate.deleteIndex(File.class);
        elasticsearchTemplate.createIndex(File.class);
        elasticsearchTemplate.putMapping(File.class);
        elasticsearchTemplate.refresh(File.class);
    }

    @PostConstruct
    public void initialize() {
        resetAllRepo();
    }

    /**
     * reload the list of repositories
     */
    public void resetAllRepo() {
        taskList.clear();
        schedulerConfig.reload();
        //TODO : for now, we just use a fileSystem crawler
        for (Repository repo : repositoryRepository.findAll()) {
            ICrawler aCrawler;
            switch (repo.getType()) {
                case GIT:
                    aCrawler = new GitCrawler(repo, klaskProperties, elasticsearchTemplate);
                    break;
                case GITLAB:
                    aCrawler = new GitlabCrawler(repo, klaskProperties, elasticsearchTemplate);
                    break;
                case SVN:
                    aCrawler = new SVNCrawler(repo, klaskProperties, fileSearchRepository, elasticsearchTemplate, repositoryRepository);
                    break;
                case FILE_SYSTEM:
                default:
                    aCrawler = new FileSystemCrawler(repo, klaskProperties, fileSearchRepository, elasticsearchTemplate);
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

    public void executeSpecificCrawler(Repository repository) {
        log.debug("[executeSpecificCrawler] on repository {}({})", repository.getName(), repository.getId());
        log.debug("[executeSpecificCrawler] taskList : {}", taskList);
        taskList.stream()
            .filter(crawler -> crawler.getRepositoryId() == repository.getId())
            .findFirst()
            .ifPresent(job -> asyncCrawler.executeCrawler(job));
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
