package io.klask.crawler.impl;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.IOException;
import java.nio.file.Path;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import io.klask.config.KlaskProperties;

public class GenericCrawlerTest {

    @Rule
    public TemporaryFolder tempFolder = new TemporaryFolder();

    @Test
    public void isFileInExclusionWithExcludedFilesTest() throws IOException {
        Path[] outFile = new Path[] {
                tempFolder.newFile("file.js").toPath(),
                tempFolder.newFile("file.js~").toPath(),
                tempFolder.newFile("file.test").toPath(),
                tempFolder.newFile("something").toPath(),
        };

        KlaskProperties conf = new KlaskProperties();
        conf.getCrawler().getMimesToExclude().add("application/javascript");
        conf.getCrawler().getExtensionsToExclude().add("test");
        conf.getCrawler().getFilesToExclude().add("something");
        GenericCrawler gc = new GenericCrawler(null, conf , null) { };
        gc.initializeProperties();

        for (Path path : outFile) {
            boolean excludedFile = gc.isFileInExclusion(path);
            assertTrue("File " + path + " must be excluded and it wasn't", excludedFile);
        }
    }

    @Test
    public void isFileInExclusionWithIncludedFilesTest() throws IOException {
        Path[] inFiles = new Path[] {
                tempFolder.newFile("file.java").toPath(),
                tempFolder.newFile("file").toPath(),
                tempFolder.newFile("file.test.more").toPath(),
                tempFolder.newFile("something-else").toPath(),
        };

        KlaskProperties conf = new KlaskProperties();
        conf.getCrawler().getMimesToExclude().add("application/javascript");
        conf.getCrawler().getExtensionsToExclude().add("test");
        conf.getCrawler().getFilesToExclude().add("something");
        GenericCrawler gc = new GenericCrawler(null, conf , null) { };
        gc.initializeProperties();

        for (Path path : inFiles) {
            boolean includedFile = gc.isFileInExclusion(path);
            assertFalse("File " + path + " must not be excluded and it was", includedFile);
        }
    }
}
