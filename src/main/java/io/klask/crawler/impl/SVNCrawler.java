package io.klask.crawler.impl;

import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.crawler.svn.SVNVisitorCrawler;
import io.klask.crawler.svn.SvnProgressCanceller;
import io.klask.domain.File;
import io.klask.domain.Repository;
import io.klask.repository.RepositoryRepository;
import io.klask.repository.search.FileSearchRepository;
import org.bouncycastle.jcajce.provider.digest.SHA256;
import org.bouncycastle.util.encoders.Hex;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.ElasticsearchException;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder;
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
import java.io.UnsupportedEncodingException;
import java.nio.charset.Charset;
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

    //JPA Repository
    private FileSearchRepository fileSearchRepository;
    private RepositoryRepository repositoriesRepository;

    private int numberOfFailedDocuments = 0;

    private KlaskProperties klaskProperties;

    private boolean crawling = false;

    private boolean abortAsked = false;

    private SvnProgressCanceller svnProgressCanceller = new SvnProgressCanceller();

    private Set<File> listeDeFichiers = new HashSet<>();

    //last revision on SVN
    private long lastRevision;
    private long originRevision;

    private Set<String> directoriesToExcludeSet = new HashSet<>();
    private Set<String> filesToExcludeSet = new HashSet<>();
    private Set<String> extensionsToExcludeSet = new HashSet<>();
    private Set<String> readableExtensionSet = new HashSet<>();

    /**
     * Constructor
     *
     * @param repo - the repo is a SVN type repository
     */
    public SVNCrawler(Repository repo, KlaskProperties klaskProperties, FileSearchRepository fileSearchRepository, ElasticsearchTemplate elasticsearchTemplate, RepositoryRepository repositoriesRepository) {
        this.repository = repo;
        this.klaskProperties = klaskProperties;
        this.fileSearchRepository = fileSearchRepository;
        this.elasticsearchTemplate = elasticsearchTemplate;
        this.repositoriesRepository = repositoriesRepository;

    }

    public static String extractName(String path) {
        return path.substring(path.lastIndexOf('/') + 1);
    }

    @Override
    public CrawlerResult start() {
        try {
            this.crawling = true;
            this.initialize();
//            this.originRevision=0;//TODO change me in initialize method
//            this.lastRevision=206361;//TODO change me in initialize method

            //TODO tester le cas où un fichier est déplacé dans l'arborescence (suppression + ajout ?)

            //this.originRevision = 206361;
            //this.lastRevision = this.svnRepository.getLatestRevision();

            repository = repositoriesRepository.findOne(repository.getId());
            this.originRevision = repository.getRevision() != null ? repository.getRevision() : 0;
            this.lastRevision = this.svnRepository.getLatestRevision();

            boolean startEmpty = (originRevision == 0);
            //final SVNNodeKind nodeKind = this.svnRepository.checkPath("", -1);

            //get the current HEAD revision
            //long lastRevision = this.svnRepository.getLatestRevision();
            long lastRevision = this.lastRevision;
            long originRevision = this.originRevision;

            log.info("Start parsing files in {} (r{})", this.repository.getPath(), lastRevision);

            //with this reporter we just say to the repository server - please, send us the entire tree,
            //we do not have any local data
            ISVNReporterBaton reporter = new ISVNReporterBaton() {
                public void report(ISVNReporter reporter) throws SVNException {
                    try {
                        reporter.setPath("", null, originRevision == 0 ? lastRevision : originRevision, SVNDepth.INFINITY,
                            startEmpty/*we are empty, take us all like in checkout*/);

                        reporter.finishReport();
                    } catch (SVNException e) {
                        log.error("SVN reporter failed", e);
                        reporter.abortReport();
                    }

                }
            };

            //our editor only stores properties of files and directories
            SVNVisitorCrawler editor = new SVNVisitorCrawler(this);
            //run an update-like request which never receives any real file deltas
            this.svnRepository.setCanceller(this.svnProgressCanceller);
            this.svnRepository.update(lastRevision, null, true, reporter, editor);


            addUpdatedFiles(editor.getUpdatedFiles());
            indexingBulkFiles();
            deleteFiles(editor.getDeletedFiles());


            //everything goes ok, so let's save the new revision with JPA
            //repository = repositoriesRepository.findOne(repository.getId());
            repository.setRevision(lastRevision);
            repositoriesRepository.save(repository);

            log.info("Finish parsing files in {} (r{})", this.repository.getPath(), lastRevision);

        } catch (final SVNCancelException e) {
            log.warn("Operation cancelled by user");
        } catch (final SVNException e) {
            log.error("Exception in SVN crawler", e);
        } finally {
            this.crawling = false;
        }

        return null;
    }

    private void deleteFiles(Map<String, Long> deletedFiles) {
        log.trace("delete bulk files : {}", deletedFiles);
        try {
            for (Map.Entry<String, Long> entry : deletedFiles.entrySet()) {
                fileSearchRepository.delete(convertSHA256(entry.getKey()));
            }
        } catch (ElasticsearchException e) {
            log.error("Exception while delete file -- getting file's list...");
            Set<String> failedDocuments = e.getFailedDocuments().keySet();
            numberOfFailedDocuments += failedDocuments.size();
            listeDeFichiers.stream()
                .filter(f -> failedDocuments.contains(f.getId()))
                .forEach(file -> log.error("Exception while delete file {}, {}", file.getPath(), e.getFailedDocuments().get(file.getId())));
        } catch (OutOfMemoryError e) {
            log.error("OutOfMemory while delete one file of the following files :");
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

    private void addUpdatedFiles(Map<String, Long> filesWithRevision) throws SVNException {
        log.debug("addUpdatedFiles {}", filesWithRevision);
        if (this.abortAsked) {
            return;
        }
        if (filesWithRevision != null) {
            for (Map.Entry<String, Long> entry : filesWithRevision.entrySet()) {
                log.trace("add file {}", entry.getKey());
                SVNProperties fileProperties = new SVNProperties();
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                svnRepository.getFile(entry.getKey(), this.lastRevision, fileProperties, baos);
                File currentFile = createFile(entry.getKey());
                currentFile.setVersion("TODO");
                currentFile.setProject("TODO");
                currentFile.setLastAuthor(fileProperties.getStringValue("svn:entry:last-author"));
                currentFile.setLastDate(fileProperties.getStringValue("svn:entry:committed-date"));
                currentFile.setSize((long) baos.size());
                currentFile.setContent(new String(baos.toByteArray(), Charset.forName("iso-8859-1")));
                addFile(currentFile);
            }
        }
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
        directoriesToExcludeSet.clear();
        directoriesToExcludeSet.addAll(klaskProperties.getCrawler().getDirectoriesToExclude());
        log.debug("exclude directories {}", directoriesToExcludeSet);

        filesToExcludeSet.clear();
        filesToExcludeSet.addAll(klaskProperties.getCrawler().getFilesToExclude());
        log.debug("exclude files : {}", filesToExcludeSet);

        extensionsToExcludeSet.clear();
        extensionsToExcludeSet.addAll(klaskProperties.getCrawler().getExtensionsToExclude());
        log.debug("exclude extensions : {}", extensionsToExcludeSet);

        readableExtensionSet.clear();
        readableExtensionSet.addAll(klaskProperties.getCrawler().getExtensionsToRead());
        log.debug("ascii files with extension : {}", readableExtensionSet);

        //Set up connection protocols support:
        if (this.svnRepository == null && this.repository != null && this.repository.getPath() != null) {
            //http:// and https://
            if (this.repository.getPath().toLowerCase().startsWith("http")) {
                DAVRepositoryFactory.setup();
                //DAVRepositoryFactory.setup(new DefaultHTTPConnectionFactory(null,true,null));
            }
            //svn://, svn+xxx:// (svn+ssh:// in particular)
            if (this.repository.getPath().toLowerCase().startsWith("file")) {
                FSRepositoryFactory.setup();
            }
            //file:///
            if (this.repository.getPath().toLowerCase().startsWith("svn")) {
                DAVRepositoryFactory.setup();
                //TODO : ça ne marche pas, mais ça devrait
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
        this.svnProgressCanceller.setAbortAsked(true);
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
            result = new File(
                convertSHA256(path),
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
     * sha256 on the file's path. It should be the same, even after a full reindex
     *
     * @param path
     * @return
     * @throws UnsupportedEncodingException
     */
    private String convertSHA256(String path) throws UnsupportedEncodingException {
        SHA256.Digest md = new SHA256.Digest();
        md.update(path.toString().getBytes("UTF-8"));
        return Hex.toHexString(md.digest());
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
            //fileSearchRepository.save(listeDeFichiers);
            if (listeDeFichiers.isEmpty()) {
                log.info("no files to index");
                return;
            }
            List<IndexQuery> queriesList = new ArrayList<>(listeDeFichiers.size());
            for (File file : listeDeFichiers) {
                IndexQuery query = new IndexQueryBuilder()
                    .withIndexName(Constants.INDEX_PREFIX + repository.getName() + "-" + repository.getId())
                    .withObject(file)
                    .withType(repository.getType().name())
                    .build();
                queriesList.add(query);
            }
            elasticsearchTemplate.bulkIndex(queriesList);

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
            listeDeFichiers.clear();
        } catch (Exception e) {
            log.error("elasticsearch node is not avaible, waiting 10s and continue", e);
            try {
                Thread.sleep(10000);
            } catch (Exception ee) {
                log.error("Error while Thread.sleep", e);
            }
        }
    }

    public Repository getRepository() {
        return repository;
    }

    public void setRepository(Repository repository) {
        this.repository = repository;
    }

    /**
     * the dir parameter need to be a directory
     * return true if the directory is in exclusion list
     * used by {@code SVNVisitorCrawler}
     *
     * @param path
     * @return
     */
    public boolean isDirectoryInExclusion(String path) {
        return directoriesToExcludeSet.contains(extractName(path));
    }

    /**
     * the parameter need to be a file, not a directory. It's used in {@code SVNVisitorCrawler}
     *
     * @param path
     * @return
     */
    public boolean isFileInExclusion(String path) {
        String fileName = extractName(path);
        return
            filesToExcludeSet.contains(fileName) || fileName.endsWith("~") ||
                extensionsToExcludeSet.contains(extractExtension(fileName, fileName.lastIndexOf(".")));
    }

    public boolean isReadableExtension(String path) {
        String fileName = extractName(path);
        String extension = extractExtension(fileName, fileName.lastIndexOf("."));
        if ((!readableExtensionSet.contains(extension) && !"".equals(extension))
            //|| size > Constants.MAX_SIZE_FOR_INDEXING_ONE_FILE
            ) {
            log.trace("parsing only name on file : {}", path);
            return false;
        } else {
            return true;
        }
    }

    public SvnProgressCanceller getSvnProgressCanceller() {
        return this.svnProgressCanceller;
    }
}
