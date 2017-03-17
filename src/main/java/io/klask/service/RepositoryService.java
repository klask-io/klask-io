package io.klask.service;

import io.klask.domain.Repository;
import io.klask.repository.RepositoryRepository;
import io.klask.repository.search.RepositorySearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.inject.Inject;

import static org.elasticsearch.index.query.QueryBuilders.queryStringQuery;

/**
 * Service Implementation for managing Repository.
 */
@Service
@Transactional
public class RepositoryService {

    private final Logger log = LoggerFactory.getLogger(RepositoryService.class);

    @Inject
    private RepositoryRepository repositoryRepository;

    @Inject
    private RepositorySearchRepository repositorySearchRepository;

    /**
     * Save a repository.
     *
     * @param repository the entity to save
     * @return the persisted entity
     */
    public Repository save(Repository repository) {
        log.debug("Request to save Repository : {}", repository);
        Repository result = repositoryRepository.save(repository);
        repositorySearchRepository.save(result);
        return result;
    }

    /**
     *  Get all the repositories.
     *
     *  @param pageable the pagination information
     *  @return the list of entities
     */
    @Transactional(readOnly = true)
    public Page<Repository> findAll(Pageable pageable) {
        log.debug("Request to get all Repositories");
        Page<Repository> result = repositoryRepository.findAll(pageable);
        return result;
    }

    /**
     *  Get one repository by id.
     *
     *  @param id the id of the entity
     *  @return the entity
     */
    @Transactional(readOnly = true)
    public Repository findOne(Long id) {
        log.debug("Request to get Repository : {}", id);
        Repository repository = repositoryRepository.findOne(id);
        return repository;
    }

    /**
     *  Delete the  repository by id.
     *
     *  @param id the id of the entity
     */
    public void delete(Long id) {
        log.debug("Request to delete Repository : {}", id);
        repositoryRepository.delete(id);
        repositorySearchRepository.delete(id);
    }

    /**
     * Search for the repository corresponding to the query.
     *
     *  @param query the query of the search
     *  @return the list of entities
     */
    @Transactional(readOnly = true)
    public Page<Repository> search(String query, Pageable pageable) {
        log.debug("Request to search for a page of Repositories for query {}", query);
        return repositorySearchRepository.search(queryStringQuery(query), pageable);
    }
}
