package io.klask.crawler.impl;

import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.domain.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.tmatesoft.svn.core.*;
import org.tmatesoft.svn.core.internal.io.dav.DAVRepositoryFactory;
import org.tmatesoft.svn.core.internal.io.fs.FSRepositoryFactory;
import org.tmatesoft.svn.core.io.SVNRepository;
import org.tmatesoft.svn.core.io.SVNRepositoryFactory;
import org.tmatesoft.svn.core.wc.SVNWCUtil;

import java.io.ByteArrayOutputStream;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.Future;

/**
 * Created by jeremie on 11/01/17.
 */
public class SVNCrawler implements ICrawler {

    private final static Set<String> motsClefsSVN = new HashSet<>(Arrays.asList("trunk", "branches", "tags"));
    private final Logger log = LoggerFactory.getLogger(SVNCrawler.class);
    //The associated repository like "svn://mysvnserver/myproject
    private Repository repository;

    //not thread-safe, should not be used in multiples threads
    private SVNRepository svnRepository;


    private boolean crawling = false;

    /**
     * Constructor
     *
     * @param repo - the repo is a SVN type repository
     */
    public SVNCrawler(Repository repo) {
        this.repository = repo;
    }

    @Override
    public CrawlerResult start() {
        try {
            this.crawling = true;
            log.debug("Start Parsing files in {}", this.repository.getPath());
            this.initialize();

            final SVNNodeKind nodeKind = this.svnRepository.checkPath("", -1);

            if (nodeKind == SVNNodeKind.DIR) {
                readInDepthSVN("/");
            }

        } catch (final SVNException e) {
            log.error("Exception in SVN crawler", e);
        } finally {
            this.crawling = false;
        }

        return null;
    }

    private void readInDepthSVN(String path) throws SVNException {
        final Collection<SVNDirEntry> entries = svnRepository.getDir(path, -1, null, (Collection) null);
        for (final SVNDirEntry entry : entries) {
            if (entry.getKind() == SVNNodeKind.FILE) {
                log.debug("SVN file {}", entry.getURL().getPath());
                SVNProperties fileProperties = new SVNProperties();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                svnRepository.getFile(entry.getURL().getPath(), -1, fileProperties, baos);
                String mimeType = fileProperties.getStringValue(SVNProperty.MIME_TYPE);
                boolean isTextType = SVNProperty.isTextMimeType(mimeType);
                log.debug("properties {} : {}", fileProperties);
                log.debug("isTextType : {}", isTextType);

            }
            if (entry.getKind() == SVNNodeKind.DIR) {
                readInDepthSVN(path.equals("") ? entry.getName() : path + "/" + entry.getName());
            }

        }
    }

    /**
     * initialize the SVN repository with the protocols beginning in the URL
     */
    private void initialize() throws SVNException {
        //Set up connection protocols support:
        if (this.svnRepository == null && this.repository != null && this.repository.getPath() != null) {
            //http:// and https://
            if (this.repository.getPath().toLowerCase().startsWith("http")) {
                DAVRepositoryFactory.setup();
            }
            //svn://, svn+xxx:// (svn+ssh:// in particular)
            if (this.repository.getPath().toLowerCase().startsWith("file")) {
                FSRepositoryFactory.setup();
            }
            //file:///
            if (this.repository.getPath().toLowerCase().startsWith("svn")) {
                DAVRepositoryFactory.setup();
                //TODO : ça ne marche, mais ça devrait
                //SVNRepositoryFactoryImpl.setup();
            }
            svnRepository = SVNRepositoryFactory.create(SVNURL.parseURIDecoded(this.repository.getPath()));
            svnRepository.setAuthenticationManager(SVNWCUtil.createDefaultAuthenticationManager(this.repository.getUsername(), this.repository.getPassword().toCharArray()));
        }
    }

    @Override
    public Future<CrawlerResult> getResult() {
        return null;
    }

    @Override
    public void setResult(Future<CrawlerResult> result) {

    }

    @Override
    public void stop() {}

    @Override
    public boolean isCrawling(){return false;}

    @Override
    public long getIndexedFiles(){return -1L;}

    @Override
    public long getTotalFiles() {
        return -1;
    }
}
