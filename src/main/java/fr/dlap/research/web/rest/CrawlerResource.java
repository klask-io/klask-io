package fr.dlap.research.web.rest;

import com.codahale.metrics.annotation.Timed;
import fr.dlap.research.config.ResearchProperties;
import fr.dlap.research.service.CrawlerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.inject.Inject;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * REST controller for managing File.
 */
@RestController
@RequestMapping("/api")
public class CrawlerResource {

    private static ExecutorService pool = Executors.newFixedThreadPool(1);
    private static Future<Void> future;
    private final Logger log = LoggerFactory.getLogger(CrawlerResource.class);

    @Inject
    private CrawlerService crawlerService;

    @Inject
    private ResearchProperties researchProperties;


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
        Callable<Void> job = () -> {
            resetIndex();
            return null;
        };
        if (future != null && !future.isDone() && !future.isCancelled()) {
            log.warn("The crawler is yet indexing files... No more jobs can be submitted");
        } else {
            future = pool.submit(job);
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
        boolean result = future != null && !future.isDone() && !future.isCancelled();
        return new ResponseEntity<>(result, HttpStatus.OK);
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
        future.cancel(true);

    }

    /**
     * Thread exécutant le reset de l'index complet
     *
     * @throws IOException
     */
    public void resetIndex() throws IOException {
        crawlerService.clearIndex();
        //TODO : ne plus supprimer l'index
        crawlerService.crawler(researchProperties.getCrawler().getDirectoriesToScan());
    }


}
