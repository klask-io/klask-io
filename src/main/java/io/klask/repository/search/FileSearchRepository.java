package io.klask.repository.search;

import io.klask.domain.File;
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

    @Query("{ \"bool\" : { \"must\" : { \"query\" : { \"term\" : { \"path\": \"?0\" } } } } }")
    File findFirstByPath(String path);

    //tentative de réaliser avec une collection de versions (pour plus tard)
    @Query("{\"bool\" : {\"must\" : {\"bool\" : {\"should\" : [ {\"field\" : {\"version.raw\" : \"?\"}}, {\"field\" : {\"version.raw\" : \"?\"}} ]}}}}")
    Page<File> findByRawVersionIn(Collection<String> version, Pageable pageable);

    @Query("{\"bool\" : {\"must\" : {\"field\" : {\"version.raw\" : \"?0\"}}}}")
    Page<File> findByRawVersion(String version, Pageable pageable);

    //finalement on utilise pas le innerField version.raw, mais sur le findAll cela n'a pas trop d'importance
    //le résultat n'est pas très pertinent de toutes façons.
    Page<File> findAllByVersion(String version, Pageable pageable);

    Page<File> findAllByProject(String project, Pageable pageable);

    Page<File> findAllByVersionAndProject(String version, String project, Pageable pageable);
}
