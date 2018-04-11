package io.klask.crawler.impl;

import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.crawler.filesystem.FileSystemVisitorCrawler;
import io.klask.crawler.filesystem.GitVisitorCrawler;
import io.klask.domain.File;
import io.klask.domain.Repository;
import org.bouncycastle.jcajce.provider.digest.SHA256;
import org.bouncycastle.util.encoders.Hex;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ListBranchCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.lib.*;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTag;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.eclipse.jgit.treewalk.TreeWalk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.FileVisitOption;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.concurrent.Future;

/**
 * Created by jeremie on 11/01/17.
 */
public class GitCrawler extends GenericCrawler implements ICrawler {


    private boolean crawling=false;

    private final Logger log = LoggerFactory.getLogger(GitCrawler.class);

    //FileVisitor implementation where it is possible to stop if received the command
    private GitVisitorCrawler visitor = new GitVisitorCrawler(this);


    public GitCrawler(Repository repository, KlaskProperties klaskProperties, ElasticsearchTemplate elasticsearchTemplate) {
        super(repository, klaskProperties, elasticsearchTemplate);

        this.elasticsearchTemplate = elasticsearchTemplate;

    }


    /**
     * Parsing one file
     *
     * @param pathFile
     */
    public void addFileInCurrentBranch(Path pathFile, String branch) {
        log.trace("Parsing file : {}", pathFile);
        String fileName = pathFile.getFileName().toString();
        int posPoint = fileName.lastIndexOf(".");
        String extension = extractExtension(fileName, posPoint);


        log.trace("explode filename : name:{}\textension:{}", fileName, extension);

        try {
            indexBulkFilesIfNecessary();
            File document = constructFile(fileName, extension, pathFile, this.repository.getName(), branch);
            listeDeFichiers.add(document);

        } catch (IOException e) {
            log.error("Exception while reading file {}", pathFile);
        } catch (Throwable t) {
            log.error("Throwable thrown while indexing file {} ", pathFile, t);
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
    protected File constructFile(String name, String extension, Path path, String project, String branch) throws IOException {

        BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
        long size = attrs.size();


        String content = null;
        if ((!readableExtensionSet.contains(extension) && !"".equals(extension))
            || size > Constants.MAX_SIZE_FOR_INDEXING_ONE_FILE) {
            log.trace("parsing only name on file : {}", path);
        } else {
            content = readContent(path);
        }
        String pathComplet = this.repository.getPath()+"@"+branch+path.toString();
        //sha3 on the file's path. It should be the same, even after a full reindex
        SHA256.Digest md = new SHA256.Digest();
        md.update(pathComplet.getBytes("UTF-8"));

        File fichier = new File(
            Hex.toHexString(md.digest()),
            name,
            extension,
            pathComplet,
            project,
            content,
            branch,
            size
        );
//        fichier.setCreatedDate(attrs.creationTime().toInstant().atZone(ZoneId.systemDefault()));
//        fichier.setLastModifiedDate(attrs.lastModifiedTime().toInstant().atZone(ZoneId.systemDefault()));

        return fichier;
    }


    private void pullRepositoryGit(Git repoGit) throws GitAPIException{
        repoGit.pull()
            .setRecurseSubmodules(SubmoduleConfig.FetchRecurseSubmodulesMode.YES)
            .call();

        //list remotes branch
        List<Ref> branches = repoGit.branchList()
            .setListMode(ListBranchCommand.ListMode.REMOTE)
            .call();
        //for each remote branch, index files
        branches.forEach(b -> checkoutBranche(b, repoGit));
    }

    private void checkoutBranche(Ref b, Git repoGit) {

        String name = b.getName();
        Ref leaf = b.getLeaf();
        Ref target = b.getTarget();
        StringTokenizer tok = new StringTokenizer(name, "/", false);
        String branchName=null;
        while(tok.hasMoreTokens()){
            String token = tok.nextToken();

            branchName=token;
        }
        try{
            boolean createBranch = !ObjectId.isId(branchName);
            if (createBranch) {
                Ref ref = repoGit.getRepository().exactRef("refs/heads/" + branchName);
                if (ref != null) {
                    createBranch = false;
                }
            }
            repoGit.checkout()
                .setCreateBranch(createBranch)
                .setName(branchName)
                .call();

            indexFilesInCurrentBranch(repoGit, branchName);
//        repoGit.checkout()
//            .setCreateBranch(true)
//            .setName(branchName)
//            .setUpstreamMode(CreateBranchCommand.SetupUpstreamMode.SET_UPSTREAM)
//            .setStartPoint("origin/"+branchName)
//            .call();


        } catch (IOException | GitAPIException e) {
            log.error("git checkout branch exception : {}", e.getMessage(), e);
        }
    }

    /**
     * index all files in the current local git branch
     * @param git
     * @param branch
     */
    private void indexFilesInCurrentBranch(Git git, String branch) {
        org.eclipse.jgit.lib.Repository repositoryGit = git.getRepository();
        Path workingDir = repositoryGit.getWorkTree().toPath();
        try{
        //this walk is just for counting docs
        long docsCount = Files.walk(workingDir)
            //.peek(p -> displayfiltered(p, "before"))
            .filter(dir -> !this.excludeDirectories(workingDir,dir))
            .filter(file -> file.toFile().isFile())
            .filter(file -> !this.isFileInExclusion(file))
            //.peek(p -> displayfiltered(p, "after"))
            .count();
            RefDatabase ref = repositoryGit.getRefDatabase();
            Map<String, Ref> map = repositoryGit.getAllRefs();
            map.entrySet().forEach( e -> log.info("maps [{}] = {}",e.getKey(), e.getValue()));

            log.debug("{} files to index", docsCount);
            visitor.setCurrentBranch(branch);
            //this time, walk is indexing each files which match patterns in visitor
//            Files.walkFileTree(workingDir,
//                EnumSet.of(FileVisitOption.FOLLOW_LINKS), Integer.MAX_VALUE, visitor);

            // TEST
            try {
                ObjectId head = repositoryGit.resolve("HEAD^{tree}");
                ObjectId previousHead = repositoryGit.resolve("HEAD~^{tree}");
                // Instanciate a reader to read the data from the Git database
//                ObjectReader reader = repositoryGit.newObjectReader();
//// Create the tree iterator for each commit
//                CanonicalTreeParser oldTreeIter = new CanonicalTreeParser();
//                oldTreeIter.reset(reader, previousHead);
//                CanonicalTreeParser newTreeIter = new CanonicalTreeParser();
//                newTreeIter.reset(reader, head);
//                List<DiffEntry> listDiffs = git.diff().setOldTree(oldTreeIter).setNewTree(newTreeIter).call();
//// Simply display the diff between the two commits
//                for (DiffEntry diff : listDiffs) {
//                    System.out.println(diff);
//                }

                RevWalk walk = new RevWalk(repositoryGit);
                Ref refBranch = repositoryGit.exactRef("refs/heads/" + branch);
                ObjectId branchId = repositoryGit.resolve("refs/heads/"+branch);

                RevCommit commit = walk.parseCommit(branchId);
                RevTree tree = commit.getTree();
                System.out.println("Having tree: " + tree);

                // now use a TreeWalk to iterate over all files in the Tree recursively
                // you can set Filters to narrow down the results if needed
                TreeWalk treeWalk = new TreeWalk(repositoryGit);
                treeWalk.addTree(tree);
                treeWalk.setRecursive(true);
                //treeWalk.setFilter(PathFilter.create("src/main/java/nds/socket/server/Reader.java"));
                //PathSuffixFilter.create(".java")

                ObjectReader objectReader = treeWalk.getObjectReader();
                while(treeWalk.next()){
                    String fileName = treeWalk.getNameString();
                    String pathAndFileName = treeWalk.getPathString();
                    log.trace("tree         : {}",pathAndFileName);
                    log.trace("tree         : {}",new String(treeWalk.getRawPath(), "utf-8"));
                    log.trace("tree filemode: {}",treeWalk.getFileMode());
                    log.trace("tree name    : {}",fileName);
                    log.trace("tree attribut: {}",treeWalk.getAttributes());
                    String extension = extractExtension(fileName, fileName.lastIndexOf("."));
                    ObjectLoader loader = objectReader.open(treeWalk.getObjectId(0)); // Constants.OBJ_BLOB
                    long size = loader.getSize();
                    String content=null;

                    if ((!readableExtensionSet.contains(extension) && !"".equals(extension))
                        || size > Constants.MAX_SIZE_FOR_INDEXING_ONE_FILE) {
                        log.trace("parsing only name on file : {}", pathAndFileName);
                    }
                    else{
                        byte[] bytes = loader.getBytes();
                        //content = new String( bytes, Charset.forName("iso-8859-1"));
                        content = new String( bytes, Charset.forName("utf-8"));
                        log.trace("tree size    : {}",loader.getSize());
                    }
                    String pathComplet = this.repository.getPath()+"@"+branch+":/"+pathAndFileName;
                    //sha3 on the file's path. It should be the same, even after a full reindex
                    SHA256.Digest md = new SHA256.Digest();
                    md.update(pathComplet.getBytes("UTF-8"));

                    File fichier = new File(
                        Hex.toHexString(md.digest()),
                        fileName,
                        extension,
                        pathComplet,
                        this.repository.getName(),
                        content,
                        branch,
                        size
                    );
                    listeDeFichiers.add(fichier);
                    indexBulkFilesIfNecessary();


                }
//                RevTag tag = walk.parseTag(refBranch.getObjectId());
            } catch (Exception e) {
                log.error("git exception", e);
            }
            //FIN TEST




//            Files.walk(new java.io.File(this.rootPath).toPath())
//                .filter(p -> p.toFile().isFile())
//                //.peek(p -> displayfiltered(p, "before"))
//                .filter(this::doesntContainsExcludeDirectoriesOrFiles)
//                //.peek(p -> displayfiltered(p, "after"))
//                .forEach(this::addFileInCurrentBranch);

            //if there are some files not indexed, run once last time permit indexing last files
            log.debug("last indexing");
            indexingBulkFiles();

        } catch (final IOException e) {
            log.error("Exception in crawler method", e);
        } finally {
            this.crawling=false;
        }
    }

    @Override
    public CrawlerResult start() {
        CrawlerResult result = new CrawlerResult();
        initializeProperties();
        checkoutAndWalkThroughGit();

        return null;

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
    }

    @Override
    public boolean isCrawling() {
        return false;
    }

    @Override
    public long getIndexedFiles() {
        return -1L;
    }

    @Override
    public long getTotalFiles() {
        return -1L;
    }

    private void checkoutAndWalkThroughGit() {

        //FileRepositoryBuilder builder = new FileRepositoryBuilder();
        //create working directory and all ancestors if necessary
        //File localPath = File.createTempFile("TestGitRepository", "");
        Path workingDir = Paths.get(klaskProperties.getCrawler().getWorkingDirectory());
        workingDir.toFile().mkdirs();
        Path pathRepo = Paths.get(workingDir.toAbsolutePath()+"/"+repository.getName());
        if(Files.exists(pathRepo)) {

            //TODO : ne plus supprimer les repos, mais faire du pull simplement (supprimer tout entre les 2 TODO)
            try {
                Files.delete(pathRepo);
                Git repoGit = Git.cloneRepository()
                    .setURI(repository.getPath())
                    .setDirectory(pathRepo.toFile())
                    .setCloneSubmodules(true)
                    .setCloneAllBranches(true)
                    .call();
                pullRepositoryGit(repoGit);
            } catch (GitAPIException | IOException e) {
                log.error("exception while deleting {}", pathRepo, e);
            }
            //TODO :  reprendre le code ci-dessous
//            try(Git repoGit = Git.open(pathRepo.toFile())){
//                pullRepositoryGit(repoGit);
//            } catch (GitAPIException | IOException e) {
//                log.error("exception while opening git directory in {} : {}",pathRepo.toString(), e.getMessage(), e);
//            }
        }else {

            try (Git repoGit = Git.cloneRepository()
                .setURI(repository.getPath())
                .setDirectory(pathRepo.toFile())
                .setCloneSubmodules(true)
                .setCloneAllBranches(true)
                .call()) {
                pullRepositoryGit(repoGit);

            } catch (GitAPIException e) {
                log.error("clone repository exception : {}", e.getMessage(), e);
            } finally {
                log.debug("finally gitcrawler checkout : {}", repository.getName());
            }
        }

    }
}
