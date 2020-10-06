package io.klask.crawler.impl;

import com.codahale.metrics.annotation.Timed;
import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.crawler.filesystem.FileSystemVisitorCrawler;
import io.klask.domain.File;
import io.klask.domain.Repository;
import io.klask.repository.search.FileSearchRepository;
import org.bouncycastle.jcajce.provider.digest.SHA256;
import org.bouncycastle.util.encoders.Hex;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;

import java.io.IOException;
import java.nio.file.FileVisitOption;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.Future;
import java.util.stream.Stream;

/**
 * Created by jeremie on 11/01/17.
 */
public class FileSystemCrawler extends GenericCrawler implements ICrawler {

    private final Logger log = LoggerFactory.getLogger(FileSystemCrawler.class);
    private Path rootPath;

    private boolean crawling = false;
    private long totalFiles = 0L;


    private Future<CrawlerResult> result;

    //FileVisitor implementation where it is possible to stop if received the command
    private FileSystemVisitorCrawler visitor = new FileSystemVisitorCrawler(this);

    public FileSystemCrawler(Repository repository, KlaskProperties klaskProperties, FileSearchRepository fileSearchRepository, ElasticsearchTemplate elasticsearchTemplate){
        super(repository, klaskProperties, elasticsearchTemplate);

        this.rootPath = new java.io.File(repository.getPath()).toPath();
        this.result = null;
        this.klaskProperties = klaskProperties;
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
        log.debug("Start Parsing files in {}", this.repository.getPath());

        initializeProperties();

        try(Stream<Path> walk = Files.walk(this.rootPath)) {
            //this walk is just for counting docs
            long docsCount = walk
                .filter(dir -> !this.excludeDirectories(this.rootPath, dir))
                .filter(file -> file.toFile().isFile())
                .filter(file -> !this.isFileInExclusion(file))
                .count();

            log.debug("{} files to index", docsCount);

            //this time, walk is indexing each files which match patterns in visitor
            Files.walkFileTree(this.rootPath,
                EnumSet.of(FileVisitOption.FOLLOW_LINKS), Integer.MAX_VALUE, visitor);

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
        log.debug("Finish to parse files in {}", this.repository.getPath());
        return new CrawlerResult();
    }



    /**
     * Parsing one file
     *
     * @param p
     */
    public void addFile(Path p) {
        log.trace("Parsing file : {}", p);
        String fileName = p.getFileName().toString();
        String extension = extractExtension(fileName);


        log.trace("explode filename : name:{}\textension:{}", fileName, extension);

        try {
            indexBulkFilesIfNecessary();
            File document = constructFile(fileName, extension, p);
            listeDeFichiers.add(document);

        } catch (IOException e) {
            log.error("Exception while reading file {}", p);
        } catch (Throwable t) {
            log.error("Throwable thrown while indexing file {} ", p, t);
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
    protected File constructFile(String name, String extension, Path path) throws IOException {

        BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
        long size = attrs.size();

        String content = null;
        if ((!readableExtensionSet.contains(extension) && !"".equals(extension))
            || size > Constants.MAX_SIZE_FOR_INDEXING_ONE_FILE) {
            log.trace("parsing only name on file : {}", path);
        } else {
            content = readContent(path);
        }

        //sha3 on the file's path. It should be the same, even after a full reindex
        SHA256.Digest md = new SHA256.Digest();
        md.update(path.toString().getBytes("UTF-8"));

        File fichier = new File(
            Hex.toHexString(md.digest()),
            name,
            extension,
            path.toString(),
            null,
            content,
            null,
            size
        );
        setVersionAndProject(fichier, path.toString());

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
