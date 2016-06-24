package fr.dlap.research.repository.search;

import fr.dlap.research.domain.File;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

/**
 * Spring Data ElasticSearch repository for the File entity.
 */
public interface FileSearchRepository extends ElasticsearchRepository<File, String> {

    public File findFileByNameAndExtensionAndPath(String name, String extension, String path);

}
