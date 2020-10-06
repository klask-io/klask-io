package io.klask.service;

import javax.inject.Inject;

import org.springframework.data.elasticsearch.annotations.Mapping;
import org.springframework.data.elasticsearch.annotations.Setting;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.core.query.AliasBuilder;
import org.springframework.data.elasticsearch.core.query.AliasQuery;
import org.springframework.stereotype.Service;

import io.klask.config.Constants;
import io.klask.domain.File;
import io.klask.repository.RepositoryRepository;

/**
 * Created by jeremie on 16/09/20.
 */
@Service
public class IndexService {

    @Inject
    private ElasticsearchTemplate elasticsearchTemplate;

    @Inject
    private RepositoryRepository repositoryRepository;

    public void initIndexes() {
        String mappingPath = File.class.getAnnotation(Mapping.class).mappingPath();
        String mappings = ElasticsearchTemplate.readFileFromClasspath(mappingPath);
        String settingPath = File.class.getAnnotation(Setting.class).settingPath();
        String settings = ElasticsearchTemplate.readFileFromClasspath(settingPath);
        //delete default index named "file"
        if (!elasticsearchTemplate.indexExists(Constants.INDEX_NAME)) {
            elasticsearchTemplate.createIndex(File.class);
            elasticsearchTemplate.putMapping(Constants.INDEX_NAME, Constants.TYPE_NAME, mappings);
        }
        AliasQuery aliasQuery = new AliasBuilder()
            .withIndexName(Constants.INDEX_NAME)
            .withAliasName(Constants.ALIAS)
            .build();
        elasticsearchTemplate.addAlias(aliasQuery);
        elasticsearchTemplate.refresh(Constants.INDEX_NAME);

    }

    public void createIndexes() {
        String mappingPath = File.class.getAnnotation(Mapping.class).mappingPath();
        String mappings = ElasticsearchTemplate.readFileFromClasspath(mappingPath);
        String settingPath = File.class.getAnnotation(Setting.class).settingPath();
        String settings = ElasticsearchTemplate.readFileFromClasspath(settingPath);

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
