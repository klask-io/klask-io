package io.klask.web.rest;

import java.io.IOException;
import java.net.URISyntaxException;

import javax.inject.Inject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.codahale.metrics.annotation.Timed;

import io.klask.service.CrawlerService;
import io.klask.service.IndexService;

/**
 * REST controller for managing File.
 */
@RestController
@RequestMapping("/api")
public class CrawlerResource {

    private final Logger log = LoggerFactory.getLogger(CrawlerResource.class);

    @Inject
    private CrawlerService crawlerService;

    @Inject
    private IndexService indexService;

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
    //@Secured(AuthoritiesConstants.ADMIN)
    @ResponseStatus(HttpStatus.OK)
    public void callCrawler() throws URISyntaxException, IOException {
        log.debug("REST request to crawler");
        if(!this.crawlerService.isCrawling()) {
            this.resetIndex();
        }
    }


    /**
     * GET /crawler
     *
     * @throws URISyntaxException
     * @throws IOException
     */
    @RequestMapping(value = "/crawler",
        method = RequestMethod.GET,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    @ResponseBody
    //@Secured(AuthoritiesConstants.ADMIN)
    public ResponseEntity<Boolean> isCrawling() throws URISyntaxException, IOException {
        log.debug("REST request to isCrawling");
        return new ResponseEntity<>(this.crawlerService.isCrawling(), HttpStatus.OK);
    }


    /**
     * Stop the crawler
     *
     * @throws URISyntaxException
     * @throws IOException
     */
    @RequestMapping(value = "/crawler",
        method = RequestMethod.DELETE,
        produces = MediaType.APPLICATION_JSON_VALUE)
    @Timed
    //@Secured(AuthoritiesConstants.ADMIN)
    @ResponseStatus(HttpStatus.OK)
    public void stopCrawler() throws URISyntaxException, IOException {
        log.debug("REST request to stopCrawler");
        this.crawlerService.cancelAllRepositories();

    }

    /**
     * Thread exécutant le reset de l'index complet
     *
     * @throws IOException
     */
    public void resetIndex() throws IOException {

        indexService.createIndexes();
        //crawlerService.clearIndex();
        //TODO : ne plus supprimer l'index
        crawlerService.resetAllRepo();
        crawlerService.crawlerAllRepo();
    }


}
