package fr.dlap.research.repository.search;

import fr.dlap.research.domain.File;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;

/**
 * Created by jeremie on 27/06/16.
 */
public interface CustomSearchRepository {

    Map<String, Long> aggregateByFieldUnique(String field, String filtre);

    Page<File> findWithHighlightedSummary(Pageable pageable, String query, List<String> version, List<String> project);

    Page<File> customSearchWithHighlightedSummary(Pageable pageable, String query, List<String> version, List<String> project);

    Page<File> customfindAll(Pageable pageable, List<String> version, List<String> project);


}
