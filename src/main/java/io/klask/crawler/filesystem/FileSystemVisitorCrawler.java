package io.klask.crawler.filesystem;

import io.klask.config.KlaskProperties;
import io.klask.crawler.impl.FileSystemCrawler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.FileVisitor;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;

/**
 * Created by jeremie on 18/02/17.
 */
public class FileSystemVisitorCrawler extends SimpleFileVisitor<Path> {

    private final Logger log = LoggerFactory.getLogger(FileSystemVisitorCrawler.class);

    private FileSystemCrawler crawler;

    private boolean abortAsked=false;

    private long indexedFiles=0;

    public FileSystemVisitorCrawler(FileSystemCrawler crawler){
        this.crawler = crawler;
    }

    @Override
    public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
        log.trace("preVisit {}",dir);
        //if(Thread.currentThread().isInterrupted()){
        if(this.abortAsked){
            return FileVisitResult.TERMINATE;
        }
        if(this.crawler.isDirectoryInExclusion(dir)){
            log.trace("exclude directory {}",dir);
            return FileVisitResult.SKIP_SUBTREE;//like SKIP_SUBTREE and no call to postVisitDirectory
        }
        return FileVisitResult.CONTINUE;
    }

    @Override
    public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
        log.trace("visitFile {}",file);
        if(attrs.isRegularFile() && !this.crawler.isFileInExclusion(file)) {
            this.indexedFiles++;
            this.crawler.addFile(file);
        }
        else{
            log.trace("exclude file {}",file);
        }
        return FileVisitResult.CONTINUE;

    }

    @Override
    public FileVisitResult visitFileFailed(Path file, IOException exc) throws IOException {
        log.error("visitFileFailed {}",file, exc);
        return FileVisitResult.CONTINUE;
    }

    @Override
    public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
        log.trace("postVisitDirectory {}",dir);
        return FileVisitResult.CONTINUE;
    }


    public void abort() {
        this.abortAsked = true;
    }

    public long getIndexedFiles() {
        return indexedFiles;
    }
}
