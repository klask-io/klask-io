package fr.dlap.research.web.rest;

import com.codahale.metrics.annotation.Timed;
import fr.dlap.research.repository.search.CustomSearchRepository;
import fr.dlap.research.web.rest.dto.ProjectDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.inject.Inject;
import java.net.URISyntaxException;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * REST controller for managing Project.
 */
@RestController
@RequestMapping("/api")
public class ProjectResource {

    private final Logger log = LoggerFactory.getLogger(ProjectResource.class);

    @Inject
    private CustomSearchRepository customSearchRepository;

    /**
     * SEARCH  /_search/projects?query=:query : search for the project corresponding
     * to the query.
     *
     * @param query the query of the project search
     * @return the result of the search
     */
    @RequestMapping(value = "/projects",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<List<ProjectDTO>> searchprojects(@RequestParam(required = false) String query)
        throws URISyntaxException {
        log.debug("REST request to search projects for query {}", query);
        Map<String, Long> projects = customSearchRepository.aggregateByRawField("project", query);
        List<ProjectDTO> listProjectDTO = new LinkedList<>();
        projects.forEach((key, value) -> listProjectDTO.add(new ProjectDTO(key, value)));
        return new ResponseEntity<>(listProjectDTO, HttpStatus.OK);
    }

}
