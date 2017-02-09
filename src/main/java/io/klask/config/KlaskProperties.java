package io.klask.config;


import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;


/**
 * Properties specific to the application klask.
 * <p>
 * <p>
 * Properties are configured in the application.yml file.
 * </p>
 */
@ConfigurationProperties(prefix = "klask", ignoreUnknownFields = false)
public class KlaskProperties {


    private final CrawlerProperties crawler = new CrawlerProperties();

    public CrawlerProperties getCrawler() {
        return crawler;
    }


    public static class CrawlerProperties {

        private String directoriesToScan = ".";

        private List<String> directoriesToExclude = new ArrayList<>();//Arrays.asList(".svn");

        private List<String> extensionsToExclude = new ArrayList<>();//Arrays.asList("sha1", "md5");

        private List<String> filesToExclude = new ArrayList<>();//Arrays.asList(".project");

        private List<String> filesToInclude = new ArrayList<>();//Arrays.asList("README");

        private List<String> extensionsToRead = new ArrayList<>();//Arrays.asList("java","txt","php","xml","properties");

        private int batchSize = 25;

        public String getDirectoriesToScan() {
            return directoriesToScan;
        }

        public void setDirectoriesToScan(String directoriesToScan) {
            this.directoriesToScan = directoriesToScan;
        }

        public List<String> getDirectoriesToExclude() {
            return directoriesToExclude;
        }

        public void setDirectoriesToExclude(List<String> directoriesToExclude) {
            this.directoriesToExclude = directoriesToExclude;
        }

        public List<String> getFilesToExclude() {
            return filesToExclude;
        }

        public void setFilesToExclude(List<String> filesToExclude) {
            this.filesToExclude = filesToExclude;
        }

        public List<String> getExtensionsToExclude() {
            return extensionsToExclude;
        }

        public void setExtensionsToExclude(List<String> extensionsToExclude) {
            this.extensionsToExclude = extensionsToExclude;
        }

        public List<String> getFilesToInclude() {
            return filesToInclude;
        }

        public void setFilesToInclude(List<String> filesToInclude) {
            this.filesToInclude = filesToInclude;
        }

        public List<String> getExtensionsToRead() {
            return extensionsToRead;
        }

        public void setExtensionsToRead(List<String> extensionsToRead) {
            this.extensionsToRead = extensionsToRead;
        }

        public int getBatchSize() {
            return batchSize;
        }

        public void setBatchSize(int batchSize) {
            this.batchSize = batchSize;
        }
    }

}
