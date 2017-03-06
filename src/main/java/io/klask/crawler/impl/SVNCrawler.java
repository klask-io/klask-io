package io.klask.crawler.impl;

import io.klask.config.KlaskProperties;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.crawler.svn.SVNVisitorCrawler;
import io.klask.domain.File;
import io.klask.domain.Repository;
import io.klask.repository.search.FileSearchRepository;
import org.bouncycastle.jcajce.provider.digest.SHA256;
import org.bouncycastle.util.encoders.Hex;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.ElasticsearchException;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.tmatesoft.svn.core.*;
import org.tmatesoft.svn.core.internal.io.dav.DAVRepositoryFactory;
import org.tmatesoft.svn.core.internal.io.fs.FSRepositoryFactory;
import org.tmatesoft.svn.core.io.ISVNReporter;
import org.tmatesoft.svn.core.io.ISVNReporterBaton;
import org.tmatesoft.svn.core.io.SVNRepository;
import org.tmatesoft.svn.core.io.SVNRepositoryFactory;
import org.tmatesoft.svn.core.wc.SVNWCUtil;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
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

    private ElasticsearchTemplate elasticsearchTemplate;

    private FileSearchRepository fileSearchRepository;

    private int numberOfFailedDocuments = 0;

    private KlaskProperties klaskProperties;

    private boolean crawling = false;

    private boolean abortAsked = false;

    private Set<File> listeDeFichiers = new HashSet<>();

    //last revision on SVN
    private long lastRevision;

    /**
     * Constructor
     *
     * @param repo - the repo is a SVN type repository
     */
    public SVNCrawler(Repository repo, KlaskProperties klaskProperties, FileSearchRepository fileSearchRepository, ElasticsearchTemplate elasticsearchTemplate) {
        this.repository = repo;
        this.klaskProperties = klaskProperties;
        this.fileSearchRepository = fileSearchRepository;
        this.elasticsearchTemplate = elasticsearchTemplate;
    }

    @Override
    public CrawlerResult start() {
        try {
            this.crawling = true;
            log.debug("Start Parsing files in {}", this.repository.getPath());
            this.initialize();

            final SVNNodeKind nodeKind = this.svnRepository.checkPath("", -1);

            //get the current HEAD revision
            long lastRevision = this.svnRepository.getLatestRevision();
            this.lastRevision = lastRevision;

            //with this reporter we just say to the repository server - please, send us the entire tree,
            //we do not have any local data
            ISVNReporterBaton reporter = new ISVNReporterBaton() {
                public void report(ISVNReporter reporter) throws SVNException {

                    reporter.setPath("", null, lastRevision, SVNDepth.INFINITY,
                        true/*we are empty, take us all like in checkout*/);

                    reporter.finishReport();

                }
            };

            //our editor only stores properties of files and directories
            SVNVisitorCrawler editor = new SVNVisitorCrawler(this);
            //run an update-like request which never receives any real file deltas
            this.svnRepository.update(lastRevision, null, true, reporter, editor);

            indexingBulkFiles();

//            //now iterate over file and directory properties and print them out to the console
//            Map dirProps = editor.getDirsToProps();
//            for (Iterator dirPathsIter = dirProps.keySet().iterator(); dirPathsIter.hasNext();) {
//                String path = (String) dirPathsIter.next();
//                Map props = (Map) dirProps.get(path);
//                System.out.println("Directory '" + path + "' has the following properties:");
//                for (Iterator propNamesIter = props.keySet().iterator(); propNamesIter.hasNext();) {
//                    String propName = (String) propNamesIter.next();
//                    SVNPropertyValue propValue = (SVNPropertyValue) props.get(propName);
//                    System.out.println("  '" + propName + "' = '" + SVNPropertyValue.getPropertyAsString(propValue) + "'");
//                }
//                System.out.println();
//            }
//
//            Map fileProps = editor.getFilesToProps();
//            for (Iterator filePathsIter = fileProps.keySet().iterator(); filePathsIter.hasNext();) {
//                String path = (String) filePathsIter.next();
//                Map props = (Map) fileProps.get(path);
//                System.out.println("File '" + path + "' has the following properties:");
//                for (Iterator propNamesIter = props.keySet().iterator(); propNamesIter.hasNext();) {
//                    String propName = (String) propNamesIter.next();
//                    SVNPropertyValue propValue = (SVNPropertyValue) props.get(propName);
//                    System.out.println("  '" + propName + "' = '" + SVNPropertyValue.getPropertyAsString(propValue) + "'");
//                }
//                System.out.println();
//            }




//            if (nodeKind == SVNNodeKind.DIR) {
//                readInDepthSVN("");
//            }

        } catch (final SVNException e) {
            log.error("Exception in SVN crawler", e);
        } finally {
            this.crawling = false;
        }

        return null;
    }

    private void readInDepthSVN(String path) throws SVNException {
        if(this.abortAsked){
            return;
        }
        final Collection<SVNDirEntry> entries = svnRepository.getDir(path, -1, null, (Collection) null);
        for (final SVNDirEntry entry : entries) {
            if (entry.getKind() == SVNNodeKind.FILE) {
                log.debug("SVN file {}", entry.getURL().toDecodedString());
                SVNProperties fileProperties = new SVNProperties();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                svnRepository.getFile(path+"/"+entry.getName(), -1, fileProperties, null);

                //String mimeType = fileProperties.getStringValue(SVNProperty.MIME_TYPE);
                //boolean isTextType = SVNProperty.isTextMimeType(mimeType);
//                log.debug("properties {} : {}", fileProperties);
//                log.debug("isTextType : {}", isTextType);
//                log.debug("commitMessage : {}",svnRepository.getRevisionPropertyValue(entry.getRevision(),SVNRevisionProperty.LOG).getString());


            }
            if (entry.getKind() == SVNNodeKind.DIR && !"tags".equals(entry.getName())) {
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
            if(this.repository.getUsername()!=null && this.repository.getPassword()!=null)
                svnRepository.setAuthenticationManager(SVNWCUtil.createDefaultAuthenticationManager(this.repository.getUsername(), this.repository.getPassword().toCharArray()));
        }
    }

    /**
     * Parsing one file
     *
     * @param file
     */
    public void addFile(File file) {
        log.trace("add file : {}", file.getPath());

        try {
            indexBulkFilesIfNecessary();
            listeDeFichiers.add(file);

        } catch (Exception e) {
            log.error("Exception while reading file {}",file, e);
        } catch (Throwable t) {
            log.error("Throwable thrown while indexing file {} ",file, t);
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
    public void stop() {
        log.debug("indexing SVN aborted by user ");
        this.abortAsked=true;
    }

    @Override
    public boolean isCrawling(){return crawling; }

    @Override
    public long getIndexedFiles(){return -1L;}

    @Override
    public long getTotalFiles() {
        return -1;
    }

    public SVNRepository getSvnRepository() {
        return svnRepository;
    }

    /**
     * create the beginning file to upload to elasticsearch
     * @param path
     * @return
     */
    public File createFile(String path) throws SVNException {
        File result = null;
        try {
            String fileName = path.substring(path.lastIndexOf('/')+1);
            int posPoint = fileName.lastIndexOf(".");
            String extension = extractExtension(fileName, posPoint);
            log.trace("createFile name:{}\textension:{}", fileName, extension);

            //ByteArrayOutputStream baos = new ByteArrayOutputStream();
            //svnRepository.getFile(path, -1, null, baos);
            //String content = readContent(baos);

            path = this.repository.getPath()+"/"+path;
            //sha3 on the file's path. It should be the same, even after a full reindex
            SHA256.Digest md = new SHA256.Digest();
            md.update(path.toString().getBytes("UTF-8"));

            result = new File(
                Hex.toHexString(md.digest()),
                fileName,
                extension,
                path,
                null,
                null,
                null,
                0L//Long.valueOf(content.length()) // TODO get size with SVN attributes, bug if files larger than 2Go, it's an integer, it should be a long
            );
        }
        catch(IOException e){
            log.error("createFile failed {}",e);
        }
        return result;


    }

    /**
     * Read the content of the file in the outputStream
     *
     * @return
     * @throws IOException
     */
    private String readContent(ByteArrayOutputStream outputStream)  {
        return new String(outputStream.toByteArray(), Charset.forName("iso-8859-1"));
    }


    private String extractExtension(String fileName, int posPoint) {
        if (posPoint > 0) {
            return fileName.substring(posPoint + 1, fileName.length()).toLowerCase();
        }
        //the file name doesn't contain a dot or the name is like ".project" so no extension
        return "";
    }


    /**
     * check the size of batch index, and index if necessary
     */
    private void indexBulkFilesIfNecessary() {
        if (listeDeFichiers.size() > klaskProperties.getCrawler().getBatchSize()) {
            indexingBulkFiles();
            listeDeFichiers.clear();
        }
    }


    /**
     * Index a bulk of files (Constant default : 100)
     *
     */
    private void indexingBulkFiles() {
        log.trace("indexing bulk files : {}", listeDeFichiers);
        try {
            fileSearchRepository.save(listeDeFichiers);
        } catch (ElasticsearchException e) {
            log.error("Exception while indexing file -- getting file's list...");
            Set<String> failedDocuments = e.getFailedDocuments().keySet();
            numberOfFailedDocuments += failedDocuments.size();
            listeDeFichiers.stream()
                .filter(f -> failedDocuments.contains(f.getId()))
                .forEach(file -> log.error("Exception while indexing file {}, {}", file.getPath(), e.getFailedDocuments().get(file.getId())));
        } catch (OutOfMemoryError e) {
            log.error("OutOfMemory while indexing one file of the following files :");
            StringBuilder sb = new StringBuilder();
            listeDeFichiers
                .forEach(file -> sb.append(file.getPath() + ","));
            log.error(sb.toString());
        } catch (Exception e) {
            log.error("elasticsearch node is not avaible, waiting 10s and continue", e);
            try {
                Thread.sleep(10000);
            } catch (Exception ee) {
                log.error("Error while Thread.sleep", e);
            }
        }
    }
}
