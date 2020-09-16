package io.klask.service;

import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.crawler.AsyncCrawler;
import io.klask.crawler.ICrawler;
import io.klask.domain.File;
import io.klask.repository.RepositoryRepository;
import io.klask.repository.search.FileSearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.annotations.Mapping;
import org.springframework.data.elasticsearch.annotations.Setting;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.core.query.AliasBuilder;
import org.springframework.data.elasticsearch.core.query.AliasQuery;
import org.springframework.stereotype.Service;

import javax.inject.Inject;
import java.util.ArrayList;
import java.util.List;

/**
 * Created by jeremie on 16/09/20.
 */
@Service
public class IndexService {


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

    public void initIndexes() {
        String mappingPath = File.class.getAnnotation(Mapping.class).mappingPath();
        String mappings = ElasticsearchTemplate.readFileFromClasspath(mappingPath);
        String settingPath = File.class.getAnnotation(Setting.class).settingPath();
        String settings = ElasticsearchTemplate.readFileFromClasspath(settingPath);
        //delete default index named "file"
        if (!elasticsearchTemplate.indexExists(Constants.INDEX_NAME)) {
            elasticsearchTemplate.createIndex(File.class);
        }
        AliasQuery aliasQuery = new AliasBuilder()
            .withIndexName(Constants.INDEX_NAME)
            .withAliasName(Constants.ALIAS)
            //.withRouting("2")
            .build();
        elasticsearchTemplate.addAlias(aliasQuery);
        elasticsearchTemplate.refresh(Constants.INDEX_NAME);

    }

    public void createIndexes() {
        String mappingPath = File.class.getAnnotation(Mapping.class).mappingPath();
        String mappings = ElasticsearchTemplate.readFileFromClasspath(mappingPath);
        String settingPath = File.class.getAnnotation(Setting.class).settingPath();
        String settings = ElasticsearchTemplate.readFileFromClasspath(settingPath);

//        Map<String, Object> mapping = elasticsearchTemplate.getMapping(File.class);
//        Map<String, Object> setting = elasticsearchTemplate.getSetting(File.class);
//        if (log.isDebugEnabled()) {
//            for (Map.Entry<String, Object> entry : mapping.entrySet()) {
//                log.debug("mapping {} : {}", entry.getKey(), entry.getValue());
//            }
//            for (Map.Entry<String, Object> entry : setting.entrySet()) {
//                log.debug("settings {} : {}", entry.getKey(), entry.getValue());
//            }
//        }

        //delete default index named "file"
        if (elasticsearchTemplate.indexExists(Constants.INDEX_NAME)) {
            elasticsearchTemplate.deleteIndex(File.class);
        }

        this.repositoryRepository.findAll().forEach(repository -> {
            String indexName = (Constants.INDEX_PREFIX + repository.getName() + "-" + repository.getId()).toLowerCase();
            if (elasticsearchTemplate.indexExists(indexName)) {
                elasticsearchTemplate.deleteIndex(indexName);
            }
            elasticsearchTemplate.createIndex(indexName, settings);
            elasticsearchTemplate.putMapping(indexName, Constants.TYPE_NAME, mappings);
            elasticsearchTemplate.refresh(indexName);
            AliasQuery aliasQuery = new AliasBuilder()
                .withIndexName(indexName)
                .withAliasName(Constants.ALIAS)
                //.withRouting("2")
                .build();
            elasticsearchTemplate.addAlias(aliasQuery);
            elasticsearchTemplate.refresh(indexName);

        });


    }
}
