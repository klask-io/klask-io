package io.klask.repository.search;

import io.klask.domain.Repository;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;

/**
 * Spring Data ElasticSearch repository for the Repository entity.
 */
public interface RepositorySearchRepository extends ElasticsearchRepository<Repository, Long> {
}
