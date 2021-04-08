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

        private List<String> directoriesToScan = new ArrayList<>();

        private String workingDirectory;

        private String privateKey;

        private String userGit;

        private List<String> directoriesToExclude = new ArrayList<>();

        private List<String> extensionsToExclude = new ArrayList<>();

        private List<String> filesToExclude = new ArrayList<>();

        private List<String> mimesToExclude = new ArrayList<>();

        private int batchSize = 25;

        public String getUserGit() {
            return userGit;
        }

        public void setUserGit(String userGit) {
            this.userGit = userGit;
        }

        public String getPrivateKey() {
            return privateKey;
        }

        public void setPrivateKey(String privateKey) {
            this.privateKey = privateKey;
        }

        public String getWorkingDirectory() {
            return workingDirectory;
        }

        public void setWorkingDirectory(String workingDirectory) {
            this.workingDirectory = workingDirectory;
        }

        public List<String> getDirectoriesToScan() {
            return directoriesToScan;
        }

        public void setDirectoriesToScan(List<String> directoriesToScan) {
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

        public List<String> getMimesToExclude() {
            return mimesToExclude;
        }

        public void setMimesToExclude(List<String> mimesToExclude) {
            this.mimesToExclude = mimesToExclude;
        }

        public int getBatchSize() {
            return batchSize;
        }

        public void setBatchSize(int batchSize) {
            this.batchSize = batchSize;
        }
    }

}
