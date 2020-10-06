package io.klask.crawler.svn;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.tmatesoft.svn.core.SVNCancelException;
import org.tmatesoft.svn.core.SVNException;
import org.tmatesoft.svn.core.wc.ISVNEventHandler;
import org.tmatesoft.svn.core.wc.SVNEvent;

/**
 * Created by jeremie on 15/03/17.
 */
public class SvnProgressCanceller implements ISVNEventHandler {

    private final Logger log = LoggerFactory.getLogger(SvnProgressCanceller.class);

    private boolean abortAsked = false;

    public void checkCancelled() throws SVNCancelException {
        if (this.abortAsked)
            throw new SVNCancelException();

    }

    public void setAbortAsked(boolean abortAsked) {
        this.abortAsked = abortAsked;
    }

    public void handleEvent(final SVNEvent event, final double progress) throws SVNException {
        log.debug("event {}, progress {}", event, progress);
    }
}
