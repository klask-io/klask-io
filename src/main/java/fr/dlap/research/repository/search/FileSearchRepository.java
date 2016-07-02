package fr.dlap.research.repository.search;

import fr.dlap.research.domain.File;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

import java.util.Collection;

/**
 * Spring Data ElasticSearch repository for the File entity.
 */
public interface FileSearchRepository extends ElasticsearchRepository<File, String> {

    File findFileByNameAndExtensionAndPath(String name, String extension, String path);

    //tentative de réaliser avec une collection de versions (pour plus tard)
    @Query("{\"bool\" : {\"must\" : {\"bool\" : {\"should\" : [ {\"field\" : {\"version.unique\" : \"?\"}}, {\"field\" : {\"version.unique\" : \"?\"}} ]}}}}")
    Page<File> findByVersionUniqueIn(Collection<String> version, Pageable pageable);

    @Query("{\"bool\" : {\"must\" : {\"field\" : {\"version.unique\" : \"?0\"}}}}")
    Page<File> findByVersionUnique(String version, Pageable pageable);

    //finalement on utilise pas le innerField version.unique, mais sur le findAll cela n'a pas trop d'importance
    //le résultat n'est pas très pertinent de toutes façons.
    Page<File> findAllByVersion(String version, Pageable pageable);

    Page<File> findAllByProject(String project, Pageable pageable);

    Page<File> findAllByVersionAndProject(String version, String project, Pageable pageable);
}
