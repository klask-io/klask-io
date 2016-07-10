package fr.dlap.research.web.rest;

import com.codahale.metrics.annotation.Timed;
import fr.dlap.research.config.Constants;
import fr.dlap.research.domain.File;
import fr.dlap.research.repository.search.CustomSearchRepository;
import fr.dlap.research.repository.search.FileSearchRepository;
import fr.dlap.research.web.rest.dto.FileDetailDTO;
import fr.dlap.research.web.rest.util.EncodingUtil;
import fr.dlap.research.web.rest.util.HeaderUtil;
import fr.dlap.research.web.rest.util.PaginationUtil;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.inject.Inject;
import javax.validation.Valid;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * REST controller for managing File.
 */
@RestController
@RequestMapping("/api")
public class FileResource {

    private final Logger log = LoggerFactory.getLogger(FileResource.class);

    @Inject
    private FileSearchRepository fileSearchRepository;

    @Inject
    private CustomSearchRepository customSearchRepository;

    /**
     * POST  /files : Create a new file.
     *
     * @param file the file to create
     * @return the ResponseEntity with status 201 (Created) and with body the new file, or with status 400 (Bad Request) if the file has already an ID
     * @throws URISyntaxException if the Location URI syntax is incorrect
     */
    @RequestMapping(value = "/files",
        method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<File> createFile(@Valid @RequestBody File file) throws URISyntaxException {
        log.debug("REST request to save File : {}", file);
        if (file.getId() != null || fileSearchRepository.findFileByNameAndExtensionAndPath(file.getName(), file.getExtension(), file.getPath()) != null) {
            return ResponseEntity.badRequest().headers(HeaderUtil.createFailureAlert("file", "idexists", "A new file cannot already have an ID")).body(null);
        }
        file.setId(UUID.randomUUID().toString());
        fileSearchRepository.save(file);
        return ResponseEntity.created(new URI("/api/files/" + file.getId()))
            .headers(HeaderUtil.createEntityCreationAlert("file", file.getId()))
            .body(file);
    }

    /**
     * PUT  /files : Updates an existing file.
     *
     * @param file the file to update
     * @return the ResponseEntity with status 200 (OK) and with body the updated file,
     * or with status 400 (Bad Request) if the file is not valid,
     * or with status 500 (Internal Server Error) if the file couldnt be updated
     * @throws URISyntaxException if the Location URI syntax is incorrect
     */
    @RequestMapping(value = "/files",
        method = RequestMethod.PUT,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<File> updateFile(@Valid @RequestBody File file) throws URISyntaxException {
        log.debug("REST request to update File : {}", file);
        if (file.getId() == null || fileSearchRepository.findFileByNameAndExtensionAndPath(file.getName(), file.getExtension(), file.getPath()) != null) {
            return createFile(file);
        }
        fileSearchRepository.save(file);
        return ResponseEntity.ok()
            .headers(HeaderUtil.createEntityUpdateAlert("file", file.getId()))
            .body(file);
    }

    /**
     * GET  /files : get all the files.
     *
     * @param pageable the pagination information
     * @param version the version filter if set
     * @param project the project filter if set
     * @return the ResponseEntity with status 200 (OK) and the list of files in body
     * @throws URISyntaxException if there is an error to generate the pagination HTTP headers
     */
    @RequestMapping(value = "/files",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<List<File>> getAllFiles(@RequestParam(required = false) String version,
                                                  @RequestParam(required = false) String project, Pageable pageable)
        throws URISyntaxException {
        log.debug("REST request to get a page for All Files with filter version {} and project {}", version, project);

        //verification if we got a request with a big page number wich is greater than the max result search window
        if (pageable.getPageNumber() * pageable.getPageSize() >= Constants.MAX_RESULT_SEARCH_WINDOW) {
            log.warn("getAllFiles : page request too high : {}", pageable.getPageNumber());
            pageable = new PageRequest(0, pageable.getPageSize());
        }
        Page<File> page;

        if (StringUtils.isEmpty(version)) {
            if (StringUtils.isEmpty(project))
                page = fileSearchRepository.findAll(pageable);
            else
                page = fileSearchRepository.findAllByProject(project, pageable);
        } else {
            if (StringUtils.isEmpty(project))
                page = fileSearchRepository.findAllByVersion(version, pageable);
            else
                page = fileSearchRepository.findAllByVersionAndProject(version, project, pageable);
        }
        //page = customSearchRepository.findWithHighlightedSummary(pageable,"",version);
        //Page<File> page = customSearchRepository.findWithHighlightedSummary("", pageable);


        HttpHeaders headers = PaginationUtil.generatePaginationHttpHeaders(page, "/api/files");
        return new ResponseEntity<>(page.getContent(), headers, HttpStatus.OK);
    }

    /**
     * GET  /files/:id : get the "id" file.
     *
     * @param id the id of the file to retrieve
     * @return the ResponseEntity with status 200 (OK) and with body the file, or with status 404 (Not Found)
     */
    @RequestMapping(value = "/files/{id}",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<FileDetailDTO> getFile(@PathVariable String id) {
        log.debug("REST request to get File : {}", id);
        File file = fileSearchRepository.findOne(id);

        //TODO vérifier que le fichier est readable (extraire la configuration dans des classes à part)
        //if( file != null && file is readable)
        if (file != null && file.getContent() != null) {
            file.setContent(EncodingUtil.convertToUTF8(file.getContent()));
        }
        return Optional.ofNullable(new FileDetailDTO(file))
            .map(result -> new ResponseEntity<>(
                result,
                HttpStatus.OK))
            .orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
    }

    /**
     * DELETE  /files/:id : delete the "id" file.
     *
     * @param id the id of the file to delete
     * @return the ResponseEntity with status 200 (OK)
     */
    @RequestMapping(value = "/files/{id}",
        method = RequestMethod.DELETE,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<Void> deleteFile(@PathVariable String id) {
        log.debug("REST request to delete File : {}", id);
	//TODO : fileRepository.delete(id);
        fileSearchRepository.delete(id);
        return ResponseEntity.ok().headers(HeaderUtil.createEntityDeletionAlert("file", id.toString())).build();
    }

    /**
     * SEARCH  /_search/files?query=:query : search for the file corresponding
     * to the query.
     *
     * @param version the version filter
     * @param project the project filter
     * @param query the query of the file search
     * @return the result of the search
     */
    @RequestMapping(value = "/_search/files",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public ResponseEntity<List<File>> searchFiles(@RequestParam(required = false) List<String> version,
                                                  @RequestParam(required = false) List<String> project,
                                                  @RequestParam String query, Pageable pageable)
        throws URISyntaxException {
        log.debug("REST request to search for a page of Files for query {}, version filter {}, project filter {}", query, version, project);
        //par défaut
        //Page<File> page = fileSearchRepository.search(queryStringQuery(query), pageable);
        String default_operator = "AND";

        //On utilise une classe custom pour construire un querybuilder, car ce querybuilder sera le même utilisé pour
        //filtrer sur les versions
        /*Page<File> page = fileSearchRepository.search(
            Queries.constructQuery(query),
            pageable);
        */

        Page<File> page = customSearchRepository.findWithHighlightedSummary(pageable, query, version, project);

        //Page<FileDTO> result = page.map(file -> convertToDTO(file));
        HttpHeaders headers = PaginationUtil.generateSearchPaginationHttpHeaders(query, page, "/api/_search/files");
        return new ResponseEntity<>(page.getContent(), headers, HttpStatus.OK);
    }

}
