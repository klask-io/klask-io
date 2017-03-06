package io.klask.crawler.svn;

import io.klask.crawler.impl.SVNCrawler;
import io.klask.domain.File;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.tmatesoft.svn.core.SVNCommitInfo;
import org.tmatesoft.svn.core.SVNException;
import org.tmatesoft.svn.core.SVNProperty;
import org.tmatesoft.svn.core.SVNPropertyValue;
import org.tmatesoft.svn.core.io.ISVNEditor;
import org.tmatesoft.svn.core.io.SVNRepository;
import org.tmatesoft.svn.core.io.diff.SVNDeltaProcessor;
import org.tmatesoft.svn.core.io.diff.SVNDiffWindow;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.util.*;

/**
 * Created by harelj on 06/03/2017.
 */
public class SVNVisitorCrawler implements ISVNEditor {
    private Stack<String> myDirectoriesStack = new Stack<>();
    private Map myDirProps = new HashMap();
    private Map myFileProps = new HashMap();
    private boolean skip=false;
    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

    private SVNDeltaProcessor myDeltaProcessor = new SVNDeltaProcessor();

    File currentFile = new File();

    private final Logger log = LoggerFactory.getLogger(SVNVisitorCrawler.class);

    private SVNCrawler svnCrawler;

    public SVNVisitorCrawler(SVNCrawler svnCrawler){
        this.svnCrawler = svnCrawler;
    }

    public void abortEdit() throws SVNException {
        //log.trace("abortEdit");
    }

    public void absentDir(String path) throws SVNException {
        //log.trace("absentDir {}", path);
    }

    public void absentFile(String path) throws SVNException {
        //log.trace("absentFile {}", path);
    }

    public void addFile(String path, String copyFromPath, long copyFromRevision) throws SVNException {
        if(skip)return;
        log.debug("addFile {}", path);
        outputStream.reset();
        currentFile = this.svnCrawler.createFile(path);
    }

    public SVNCommitInfo closeEdit() throws SVNException {
        //log.debug("closeEdit");
        return null;
    }

    //in the closeFile, the md5Checksum give the MD5 check sum
    public void closeFile(String path, String md5Checksum) throws SVNException {
        //log.debug("closeFile {}:{}",path,md5Checksum);
        if(skip)return;
        currentFile.setContent(new String(outputStream.toByteArray(), Charset.forName("iso-8859-1")));
        currentFile.setSize((long)outputStream.size());//TODO fix the int => long problem

        this.svnCrawler.addFile(currentFile);

    }

    public void deleteEntry(String path, long revision) throws SVNException {
        //log.debug("deleteEntry {} : {}", path, revision);
    }

    public void openFile(String path, long revision) throws SVNException {
        ////log.debug("openFile {}:{}",path,revision);
    }

    public void targetRevision(long revision) throws SVNException {
        //log.debug("targetRevision {}", revision);
    }

    public void applyTextDelta(String path, String baseChecksum) throws SVNException {
        //log.trace("applyTextDelta {} ck {}", path, baseChecksum);
        if(skip)return;
        myDeltaProcessor.applyTextDelta(null , outputStream, false);
    }

    public OutputStream textDeltaChunk(String path, SVNDiffWindow diffWindow) throws SVNException {
        //log.trace("textDeltaChunk {}:{}",path,diffWindow);
        if(skip)return null;
        return myDeltaProcessor.textDeltaChunk( diffWindow );


//        try {
//            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
//            diffWindow.writeTo(outputStream, false, true);
//
//            currentFile.setContent(new String(outputStream.toByteArray(), Charset.forName("iso-8859-1")));
//            currentFile.setSize((long)diffWindow.getDataLength());//TODO fix the int => long problem
//            return outputStream;
//        }
//        catch(Exception e){
//            log.error("read failed on {}",path, e);
//        }
//
//        return null;
    }

    public void textDeltaEnd(String path) throws SVNException {
        //log.trace("textDeltaEnd {}", path);
        if(skip)return;
        myDeltaProcessor.textDeltaEnd( );
    }

    public void addDir(String path, String copyFromPath, long copyFromRevision) throws SVNException {
        //log.trace("addDir {}", path);
        if(path!=null && path.endsWith("tags")){
            skip=true;
        }
        String absouluteDirPath = "/" + path;
        myDirectoriesStack.push(absouluteDirPath);
    }

    public void changeDirProperty(String name, SVNPropertyValue value) throws SVNException {
        //filter out svn:entry and svn:wc properties since we are interested in regular properties only
//        if (!SVNProperty.isRegularProperty(name)) {
//            return;
//        }
        if(skip)return;
        if("svn:entry:last-author".equals(name) && currentFile!=null){
            currentFile.setVersion(value.getString());
        }


        String currentDirPath = (String) myDirectoriesStack.peek();
        Map props = (Map) myDirProps.get(currentDirPath);
        if (props == null) {
            props = new HashMap();
            myDirProps.put(currentDirPath, props);
        }
        props.put(name, value);
    }

    public void changeFileProperty(String path, String propertyName, SVNPropertyValue propertyValue) throws SVNException {
        //log.trace("property {} : {}",propertyName,propertyValue);
        //filter out svn:entry and svn:wc properties since we are interested in regular properties only
//        if (!SVNProperty.isRegularProperty(propertyName)) {
//            return;
//        }
        if(skip) return;
        if(SVNProperty.isSVNKitProperty(propertyName)){
            log.trace("sha1 {}", propertyName);
        }
        if("svn:entry:last-author".equals(propertyName) && currentFile!=null){
            currentFile.setVersion(propertyValue.getString());
        }


        String absolutePath = "/" + path;
        Map props = (Map) myFileProps.get(absolutePath);
        if (props == null) {
            props = new HashMap();
            myFileProps.put(absolutePath, props);
        }
        props.put(propertyName, propertyValue);
    }

    public void closeDir() throws SVNException {
        //log.trace("closeDir");
        String last = myDirectoriesStack.pop();
        if(last!=null && last.endsWith("tags"))
            skip=false;


    }

    public void openDir(String path, long revision) throws SVNException {
        //log.trace("openDir {} : {}",path,revision);
        String absoluteDirPath = "/" + path;
        myDirectoriesStack.push(absoluteDirPath);
    }

    public void openRoot(long revision) throws SVNException {
        //log.trace("openRoot : {}",revision);
        String absoluteDirPath = "/";
        myDirectoriesStack.push(absoluteDirPath);
    }

    public Map getDirsToProps() {
        return myDirProps;
    }

    public Map getFilesToProps() {
        return myFileProps;
    }
}
