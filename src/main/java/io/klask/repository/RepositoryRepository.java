package io.klask.repository;

import io.klask.domain.Repository;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data JPA repository for the Repository entity.
 */
public interface RepositoryRepository extends JpaRepository<Repository, Long> {

}
