package io.klask.repository.search;

import io.klask.domain.File;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

/**
 * Created by jeremie on 27/06/16.
 */
public interface CustomSearchRepository {

    Map<String, Long> aggregateByRawField(String field, String filtre);

//    Page<File> findWithHighlightedSummary(Pageable pageable, String query, List<String> version, List<String> project);

    Page<File> customSearchWithHighlightedSummary(Pageable pageable, String query, List<String> version, List<String> project, List<String> extension);

    Page<File> customfindAll(Pageable pageable, List<String> version, List<String> project, List<String> extension);

    File findOne(String id);
}
