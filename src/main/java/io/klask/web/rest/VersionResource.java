package io.klask.web.rest;

import com.codahale.metrics.annotation.Timed;
import io.klask.repository.search.CustomSearchRepository;
import io.klask.web.rest.dto.VersionDTO;
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
 * REST controller for managing Version.
 */
@RestController
@RequestMapping("/api")
public class VersionResource {

    private final Logger log = LoggerFactory.getLogger(VersionResource.class);

    @Inject
    private CustomSearchRepository customSearchRepository;

    /**
     * SEARCH  /_search/versions?query=:query : search for the version corresponding
     * to the query.
     *
     * @param query the query of the version search
     * @return the result of the search
     */
    @RequestMapping(value = "/versions",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<List<VersionDTO>> searchversions(@RequestParam(required = false) String query)
        throws URISyntaxException {
        log.debug("REST request to search versions for query {}", query);
        Map<String, Long> versions = customSearchRepository.aggregateByRawField("version", query);
        List<VersionDTO> listVersionDTO = new LinkedList<>();
        versions.forEach((key, value) -> listVersionDTO.add(new VersionDTO(key, value)));
        return new ResponseEntity<>(listVersionDTO, HttpStatus.OK);
    }

}
