package fr.dlap.research.web.rest;

import com.codahale.metrics.annotation.Timed;
import fr.dlap.research.repository.search.CustomSearchRepository;
import fr.dlap.research.web.rest.dto.ExtensionDTO;
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
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/**
 * REST controller for managing Extension.
 */
@RestController
@RequestMapping("/api")
public class ExtensionResource {

    private final Logger log = LoggerFactory.getLogger(ExtensionResource.class);

    @Inject
    private CustomSearchRepository customSearchRepository;

    /**
     * SEARCH  /_search/extensions?query=:query : search for the extension corresponding
     * to the query.
     *
     * @param query the query of the extension search
     * @return the result of the search
     */
    @RequestMapping(value = "/extensions",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<List<ExtensionDTO>> searchextensions(@RequestParam(required = false) String query)
        throws URISyntaxException {
        log.debug("REST request to search extensions for query {}", query);
        Map<String, Long> extensions = customSearchRepository.aggregateByRawField("extension", query);
        if (extensions.containsKey("")) {
            extensions.put("empty", extensions.get(""));
            extensions.remove("");
        }
        Map<String, Long> result = new LinkedHashMap<>();
        extensions.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
            .forEachOrdered(x -> result.put(x.getKey(), x.getValue()));

        List<ExtensionDTO> listExtensionDTO = new LinkedList<>();
        result.forEach((key, value) -> listExtensionDTO.add(new ExtensionDTO(key, value)));
        return new ResponseEntity<>(listExtensionDTO, HttpStatus.OK);
    }

}
