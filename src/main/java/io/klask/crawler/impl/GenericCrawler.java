package io.klask.crawler.impl;

import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.domain.File;
import io.klask.domain.Repository;

import org.apache.tika.Tika;
import org.bouncycastle.jcajce.provider.digest.SHA256;
import org.bouncycastle.util.encoders.Hex;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.ElasticsearchException;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public abstract class GenericCrawler {

    private final Logger log = LoggerFactory.getLogger(GenericCrawler.class);

    protected KlaskProperties klaskProperties;

    protected ElasticsearchTemplate elasticsearchTemplate;

    protected Set<File> listeDeFichiers = new HashSet<>();
    protected Repository repository;
    protected int numberOfFailedDocuments = 0;

    private final Set<String> directoriesToExclude = new HashSet<>();
    private final Set<String> filesToExclude = new HashSet<>();
    private final Set<String> extensionsToExclude = new HashSet<>();
    private final Set<String> mimesToExclude = new HashSet<>();
    private final Tika tikaFacade;

    GenericCrawler(Repository repository, KlaskProperties klaskProperties, ElasticsearchTemplate elasticsearchTemplate) {
        this(repository, klaskProperties, elasticsearchTemplate, new Tika());
    }

    GenericCrawler(Repository repository, KlaskProperties klaskProperties, ElasticsearchTemplate elasticsearchTemplate, Tika tikaFacade){
        this.repository = repository;
        this.klaskProperties = klaskProperties;
        this.elasticsearchTemplate = elasticsearchTemplate;
        this.tikaFacade = tikaFacade;
    }

    /**
     * Initialize all properties for the crawler like directories to exclude, files extension to read, etc..
     */
    protected void initializeProperties(){
        directoriesToExclude.clear();
        directoriesToExclude.addAll(klaskProperties.getCrawler().getDirectoriesToExclude());
        log.debug("exclude directories {}", directoriesToExclude);

        filesToExclude.clear();
        filesToExclude.addAll(klaskProperties.getCrawler().getFilesToExclude());
        log.debug("exclude files : {}", filesToExclude);

        extensionsToExclude.clear();
        extensionsToExclude.addAll(klaskProperties.getCrawler().getExtensionsToExclude());
        log.debug("exclude extensions : {}", extensionsToExclude);

        mimesToExclude.clear();
        mimesToExclude.addAll(klaskProperties.getCrawler().getMimesToExclude());
        log.debug("exclude files with MIME type: {}", mimesToExclude);

        numberOfFailedDocuments = 0;
    }

    /**
     * this method is only used in count. Because the parameter dirOrFile could be either directory or file.
     * @param dirOrFile
     * @return
     */
    protected boolean excludeDirectories(Path rootPath, Path dirOrFile){
        final boolean[] exclude = {false};
        rootPath.relativize(dirOrFile).forEach((Path subPath) -> {
                exclude[0] |=directoriesToExclude.contains(subPath.toString());
            }
        );
        return exclude[0];
    }

    /**
     * check the size of batch index, and index if necessary
     */
    protected void indexBulkFilesIfNecessary() {
        if (listeDeFichiers.size() > klaskProperties.getCrawler().getBatchSize()) {
            indexingBulkFiles();
            listeDeFichiers.clear();
        }
    }

    /**
     * the parameter need to be a file, not a directory. It's used in {@code FileSystemVisitorCrawler}
     * @param filePath
     * @return
     */
    public boolean isFileInExclusion(Path filePath){
        String fileName = filePath.getFileName().toString();
        return
            filesToExclude.contains(fileName) || fileName.endsWith("~") ||
                extensionsToExclude.contains(extractExtension(fileName)) ||
                isMimeExcluded(filePath);
    }

    private boolean isMimeExcluded(Path filePath) {
        try {
            String mediaType = tikaFacade.detect(filePath);
            return mimesToExclude.contains(mediaType);
        } catch (IOException e) {
            log.error("Error when detecting the mime-type for file {}", filePath, e);
        }
        return true;
    }

    /**
     * the dir parameter need to be a directory
     * return true if the directory is in exclusion list
     * used by {@code FileSystemVisitorCrawler}
     * @param dir
     * @return
     */
    public boolean isDirectoryInExclusion(Path dir){
        return directoriesToExclude.contains(dir.getFileName().toString());
    }

    /**
     * extract the file's extension (if any)
     * @param fileName
     * @param posPoint if posPoint <= 0 then return empty string
     * @return
     */
    protected String extractExtension(String fileName) {
        int posPoint = fileName.lastIndexOf(".");
        if (posPoint > 0) {
            return fileName.substring(posPoint + 1, fileName.length()).toLowerCase();
        }
        //the file name doesn't contain a dot or the name is like ".project" so no extension
        return "";
    }

    /**
     * sha256 on the file's path. It should be the same, even after a full reindex
     *
     * @param path
     * @return
     * @throws UnsupportedEncodingException
     */
    protected String convertSHA256(String path) throws UnsupportedEncodingException {
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
    protected String readContent(ByteArrayOutputStream outputStream)  {
        return new String(outputStream.toByteArray(), Charset.forName("iso-8859-1"));
    }

    /**
     * Read the content of the file at the root path p
     *
     * @param p
     * @return
     * @throws IOException
     */
    protected String readContent(Path p) throws IOException {
        byte[] content = Files.readAllBytes(p);
        return new String(content, Charset.forName("iso-8859-1"));

    }

    /**
     * Index a bulk of files (Constant default : 100)
     *
     */
    protected void indexingBulkFiles() {
        log.trace("indexing bulk files : {}", listeDeFichiers);
        try {
            //fileSearchRepository.save(listeDeFichiers);
            if (listeDeFichiers.isEmpty()) {
                log.info("no files to index");
                return;
            }
            String indexName = (Constants.INDEX_PREFIX + repository.getName() + "-" + repository.getId()).toLowerCase();
            List<IndexQuery> queriesList = new ArrayList<>(listeDeFichiers.size());
            for (File file : listeDeFichiers) {
                IndexQuery query = new IndexQueryBuilder()
                    .withIndexName(indexName)
                    .withObject(file)
                    //.withType(repository.getType().name())
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

}
