package fr.dlap.research.web.rest;

import com.codahale.metrics.annotation.Timed;
import fr.dlap.research.service.CrawlerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import javax.inject.Inject;
import java.io.IOException;
import java.net.URISyntaxException;

/**
 * REST controller for managing File.
 */
@RestController
@RequestMapping("/api")
public class CrawlerResource {

    private final Logger log = LoggerFactory.getLogger(CrawlerResource.class);

    @Inject
    private CrawlerService crawlerService;

    @Value("${directoryToScan:.}")
    private String directoryToScan;

    /**
     * POST  /crawler : Call the crawler
     *
     * @throws URISyntaxException if the Location URI syntax is incorrect
     * @throws IOException        if files are incorrect
     */
    @RequestMapping(value = "/crawler",
        method = RequestMethod.POST,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    public void callCrawler() throws URISyntaxException, IOException {
        log.debug("REST request to crawler");
        crawlerService.clearIndex();
        //TODO : ne plus supprimer l'index
        crawlerService.crawler(directoryToScan);
    }


}
