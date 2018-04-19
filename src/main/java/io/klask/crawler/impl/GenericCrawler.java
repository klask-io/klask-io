package io.klask.crawler.impl;

import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.domain.File;
import io.klask.domain.Repository;
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


    protected Set<String> directoriesToExcludeSet = new HashSet<>();
    protected Set<String> filesToExcludeSet = new HashSet<>();
    protected Set<String> extensionsToExcludeSet = new HashSet<>();
    protected Set<String> readableExtensionSet = new HashSet<>();
    protected Set<File> listeDeFichiers = new HashSet<>();
    protected  Repository repository;
    protected int numberOfFailedDocuments = 0;


    public GenericCrawler(Repository repository, KlaskProperties klaskProperties, ElasticsearchTemplate elasticsearchTemplate){
        this.repository = repository;
        this.klaskProperties = klaskProperties;
        this.elasticsearchTemplate = elasticsearchTemplate;

    }

    /**
     * Initialize all properties for the crawler like directories to exclude, files extension to read, etc..
     */
    protected void initializeProperties(){
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
    }


    /**
     * this method is only used in count. Because the parameter dirOrFile could be either directory or file.
     * @param dirOrFile
     * @return
     */
    protected boolean excludeDirectories(Path rootPath, Path dirOrFile){
        final boolean[] exclude = {false};
        rootPath.relativize(dirOrFile).forEach((Path subPath) -> {
                exclude[0] |=directoriesToExcludeSet.contains(subPath.toString());
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
     * @param file
     * @return
     */
    public boolean isFileInExclusion(Path file){
        String fileName = file.getFileName().toString();
        return
            filesToExcludeSet.contains(fileName) || fileName.endsWith("~") ||
                extensionsToExcludeSet.contains(extractExtension(fileName, fileName.lastIndexOf(".")));
    }
    /**
     * the parameter need to be a file, not a directory. It's used in {@code SVNVisitorCrawler}
     *
     * @param path
     * @return
     */
    protected boolean isFileInExclusion(String path) {
        String fileName = extractName(path);
        return
            filesToExcludeSet.contains(fileName) || fileName.endsWith("~") ||
                extensionsToExcludeSet.contains(extractExtension(fileName, fileName.lastIndexOf(".")));
    }

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
     * extract the name of file
     * @param path
     * @return
     */
    protected static String extractName(String path) {
        return path.substring(path.lastIndexOf('/') + 1);
    }


    /**
     * the dir parameter need to be a directory
     * return true if the directory is in exclusion list
     * used by {@code SVNVisitorCrawler}
     *
     * @param path
     * @return
     */
    protected boolean isDirectoryInExclusion(String path) {
        return directoriesToExcludeSet.contains(extractName(path));
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

    /**
     * extract the file's extension (if any)
     * @param fileName
     * @param posPoint if posPoint <= 0 then return empty string
     * @return
     */
    protected String extractExtension(String fileName, int posPoint) {
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
