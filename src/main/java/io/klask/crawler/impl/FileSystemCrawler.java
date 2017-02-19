package io.klask.crawler.impl;

import com.codahale.metrics.annotation.Timed;
import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.crawler.filesystem.FileSystemVisitorCrawler;
import io.klask.domain.File;
import io.klask.repository.search.FileSearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.ElasticsearchException;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.FileVisitOption;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Future;
import java.util.stream.Collectors;

/**
 * Created by jeremie on 11/01/17.
 */
public class FileSystemCrawler implements ICrawler {

    private final Logger log = LoggerFactory.getLogger(FileSystemCrawler.class);

    private FileSearchRepository fileSearchRepository;

    private KlaskProperties klaskProperties;

    private String before;

    private String root;
    Path rootPath;
    private boolean crawling=false;
    private long totalFiles=0L;

    private Set<String> directoriesToExcludeSet = new HashSet<>();
    private Set<String> filesToExcludeSet = new HashSet<>();
    private Set<String> extensionsToExcludeSet = new HashSet<>();
    private Set<String> readableExtensionSet = new HashSet<>();
    private Set<File> listeDeFichiers = new HashSet<>();

    private ElasticsearchTemplate elasticsearchTemplate;

    private int numberOfFailedDocuments = 0;

    private Future<CrawlerResult> result;

    //FileVisitor implementation where it is possible to stop if received the command
    private FileSystemVisitorCrawler visitor = new FileSystemVisitorCrawler(this);

    public FileSystemCrawler(String root, KlaskProperties klaskProperties, FileSearchRepository fileSearchRepository, ElasticsearchTemplate elasticsearchTemplate){
        super();
        this.root = root;
        this.rootPath = new java.io.File(this.root).toPath();
        this.result = null;
        this.klaskProperties = klaskProperties;
        this.fileSearchRepository = fileSearchRepository;
        this.elasticsearchTemplate = elasticsearchTemplate;
    }



    @Override
    public Future<CrawlerResult> getResult() {
        return this.result;
    }

    @Override
    public void setResult(Future<CrawlerResult> result) {
        this.result = result;
    }

    /**
     * execute the crawler on the root directory
     *
     */
    @Override
    @Timed
    public CrawlerResult start() {
        this.crawling=true;
        log.debug("Start Parsing files in {}", root);

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

        numberOfFailedDocuments = 0;

        try {

            long docsCount = Files.walk(this.rootPath)
                //.peek(p -> displayfiltered(p, "before"))
                .filter(dir -> !this.excludeDirectories(dir))
                .filter(file -> file.toFile().isFile())
                .filter(file -> !this.isFileInExclusion(file))
                //.peek(p -> displayfiltered(p, "after"))
                .count();

            log.debug("{} files to index", docsCount);

            Files.walkFileTree(this.rootPath,
                EnumSet.of(FileVisitOption.FOLLOW_LINKS), Integer.MAX_VALUE, visitor);


//            Files.walk(new java.io.File(this.rootPath).toPath())
//                .filter(p -> p.toFile().isFile())
//                //.peek(p -> displayfiltered(p, "before"))
//                .filter(this::doesntContainsExcludeDirectoriesOrFiles)
//                //.peek(p -> displayfiltered(p, "after"))
//                .forEach(this::addFile);

            //if there are some files not indexed, run once last time permit indexing last files
            log.debug("last indexing");
            indexingBulkFiles();

        } catch (final IOException e) {
            log.error("Exception in crawler method", e);
        } catch (Throwable t) {
            log.error("Throwable thrown " + t.getMessage(), t);
        }finally {
            this.crawling=false;
        }


        if (numberOfFailedDocuments > 0) {
            log.error("{} files with indexing errors", numberOfFailedDocuments);
        }
        log.debug("Finish to parse files in {}", this.root);
        return new CrawlerResult();
    }

    private String extractExtension(String fileName, int posPoint) {
        if (posPoint > 0) {
            return fileName.substring(posPoint + 1, fileName.length()).toLowerCase();
        }
        //the file name doesn't contain a dot or the name is like ".project" so no extension
        return "";
    }

    private String extractName(String fileName, int posPoint) {
        if (posPoint > 0) {
            return fileName.substring(0, posPoint);
        }
        //the file name doesn't contain a dot or if there is a dot, like .project, ".project" is the name
        return fileName;
    }

    private void displayfiltered(Path path, String position) {
        if("before".equals(position)){
            if(this.before!=null){
                log.debug("{} is filtered", this.before);
            }
            this.before = path.toString();
        }
        if("after".equals(position)){
            if(!path.toString().equals(this.before)){
                log.debug("bizarre {}",path);
            }
            this.before=null;
        }
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
     * Parsing one file
     *
     * @param p
     */
    public void addFile(Path p) {
        log.trace("Parsing file : {}", p);
        String fileName = p.getFileName().toString();
        int posPoint = fileName.lastIndexOf(".");
        String extension = extractExtension(fileName, posPoint);
        String name = extractName(fileName, posPoint);

        log.trace("explode filename : name:{}\textension:{}", name, extension);

        try {
            indexBulkFilesIfNecessary();
            File document = constructFile(name, extension, p);
            listeDeFichiers.add(document);

        } catch (IOException e) {
            log.error("Exception while reading file {}", p);
        } catch (Throwable t) {
            log.error("Throwable thrown while indexing file {} ", p, t);
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

    /**
     * Construct a {@link File} with a version and readContent
     *
     * @param name
     * @param extension
     * @param path
     * @return
     * @throws IOException
     */
    private File constructFile(String name, String extension, Path path) throws IOException {

        BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
        long size = attrs.size();

        String content = null;
        if ((!readableExtensionSet.contains(extension) && !"".equals(extension))
            || size > Constants.MAX_SIZE_FOR_INDEXING_ONE_FILE) {
            log.trace("parsing only name on file : {}", path);
        } else {
            content = readContent(path);
        }

        File fichier = new File(
            UUID.randomUUID().toString(),
            name,
            extension,
            path.toString(),
            null,
            content,
            null,
            size
        );
        setVersionAndProject(fichier, path.toString());
        fichier.setCreatedDate(attrs.creationTime().toInstant().atZone(ZoneId.systemDefault()));
        fichier.setLastModifiedDate(attrs.lastModifiedTime().toInstant().atZone(ZoneId.systemDefault()));

        return fichier;
    }

    private void setVersionAndProject(File fichier, String path) {
        String project = null;//par défaut
        String version = "trunk";//par défaut
        if (path.contains("/branches/")) {
            int positionBranches = path.indexOf("/branches/");
            version = path.substring(positionBranches + 10, path.indexOf("/", positionBranches + 10));
            if (positionBranches > 1) {
                project = path.substring(path.lastIndexOf("/", positionBranches - 1) + 1, positionBranches);
            }
        } else if (path.contains("trunk")) {
            int positionBranches = path.indexOf("/trunk/");
            if (positionBranches > 1) {
                project = path.substring(path.lastIndexOf("/", positionBranches - 1) + 1, positionBranches);
            }
        }
        fichier.setVersion(version);
        fichier.setProject(project);
    }

    /**
     * Read the content of the file at the root path p
     *
     * @param p
     * @return
     * @throws IOException
     */
    private String readContent(Path p) throws IOException {
        byte[] content = Files.readAllBytes(p);
        return new String(content, Charset.forName("iso-8859-1"));

    }

    /**
     * Test if the Path contains an exclude directory, an exclude file or an file with an exclude extension
     *
     * @param path
     */


    /**
     * the dir parameter need to be a directory
     * return true if the directory is in exclusion list
     * used by {@code FileSystemVisitorCrawler}
     * @param dir
     * @return
     */
    public boolean isDirectoryInExclusion(Path dir){
        return directoriesToExcludeSet.contains(dir.getFileName().toString());
    }

    /**
     * this method is only used in count. Because the parameter dirOrFile could be either directory or file.
     * @param dirOrFile
     * @return
     */
    public boolean excludeDirectories(Path dirOrFile){
        final boolean[] exclude = {false};
        rootPath.relativize(dirOrFile).forEach((Path subPath) -> {
                exclude[0] |=directoriesToExcludeSet.contains(subPath.toString());
            }
        );
        return exclude[0];
    }

    /**
     * the parameter need to be a file, not a directory. It's used in {@code FileSystemVisitorCrawler}
     * @param file
     * @return
     */
    public boolean isFileInExclusion(Path file){
        String fileName = file.getFileName().toString();
        return
            filesToExcludeSet.contains(fileName) || fileName.endsWith("~") ||
            extensionsToExcludeSet.contains(extractExtension(fileName, fileName.lastIndexOf(".")));
    }

    @Override
    public void stop(){
        log.debug("indexing aborted by user ");
        visitor.abort();
    }

    @Override
    public boolean isCrawling() {
        return crawling;
    }

    @Override
    public long getIndexedFiles(){
        return visitor.getIndexedFiles();
    }

    @Override
    public long getTotalFiles() {
        return this.totalFiles;
    }
}
