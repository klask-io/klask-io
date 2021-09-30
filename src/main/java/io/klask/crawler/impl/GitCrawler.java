package io.klask.crawler.impl;

import static org.eclipse.jgit.lib.Constants.OBJ_BLOB;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.Map;
import java.util.StringTokenizer;
import java.util.concurrent.Future;

import org.bouncycastle.jcajce.provider.digest.SHA256;
import org.bouncycastle.util.encoders.Hex;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.ListBranchCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectLoader;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevTree;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.transport.CredentialsProvider;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.eclipse.jgit.treewalk.TreeWalk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;

import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.domain.File;
import io.klask.domain.Repository;

/**
 * Created by jeremie on 11/01/17.
 */
public class GitCrawler extends GenericCrawler implements ICrawler {

    private final Logger log = LoggerFactory.getLogger(GitCrawler.class);

    private boolean crawling = false;

    public GitCrawler(Repository repository, KlaskProperties klaskProperties, ElasticsearchTemplate elasticsearchTemplate) {
        super(repository, klaskProperties, elasticsearchTemplate);
    }

    /**
     * Parsing one file
     *
     * @param pathFile
     */
    public void addFileInCurrentBranch(Path pathFile, String branch) {
        log.trace("Parsing file : {}", pathFile);
        String fileName = pathFile.getFileName().toString();
        String extension = extractExtension(fileName);


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
        if (size > Constants.MAX_SIZE_FOR_INDEXING_ONE_FILE || isFileInExclusion(path)) {
            log.trace("parsing only name on file : {}", path);
        } else {
            content = readContent(path);
        }
        String pathComplet = this.repository.getPath() + "@" + branch + path.toString();
        //sha3 on the file's path. It should be the same, even after a full reindex
        SHA256.Digest md = new SHA256.Digest();
        md.update(pathComplet.getBytes(StandardCharsets.UTF_8));

        return new File(
            Hex.toHexString(md.digest()),
            name,
            extension,
            pathComplet,
            project,
            content,
            branch,
            size
        );
    }


    private void pullRepositoryGit(Git repoGit) throws GitAPIException {
        repoGit.clean();
//        repoGit
//            .pull()
//            .setRecurseSubmodules(SubmoduleConfig.FetchRecurseSubmodulesMode.YES)
//            .call();

        //list remotes branch
        List<Ref> branches = repoGit.branchList()
            .setListMode(ListBranchCommand.ListMode.REMOTE)
            .call();
        //for each remote branch, index files
        branches.forEach(b -> checkoutBranche(b, repoGit));
    }

    private void checkoutBranche(Ref b, Git repoGit) {

        String name = b.getName();
        StringTokenizer tok = new StringTokenizer(name, "/", false);
        String branchName = null;
        while (tok.hasMoreTokens()) {
            String token = tok.nextToken();

            branchName = token;
        }
        try {
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
     *
     * @param git
     * @param branch
     */
    private void indexFilesInCurrentBranch(Git git, String branch) {
        org.eclipse.jgit.lib.Repository repositoryGit = git.getRepository();
        Path workingDir = repositoryGit.getWorkTree().toPath();
        try {
            //this walk is just for counting docs
            long docsCount = Files.walk(workingDir)
                //.peek(p -> displayfiltered(p, "before"))
                .filter(dir -> !this.excludeDirectories(workingDir, dir))
                .filter(file -> file.toFile().isFile())
                .filter(file -> !this.isFileInExclusion(file))
                //.peek(p -> displayfiltered(p, "after"))
                .count();

            Map<String, Ref> map = repositoryGit.getAllRefs();
            map.entrySet().forEach(e -> log.info("maps [{}] = {}", e.getKey(), e.getValue()));

            log.debug("{} files to index", docsCount);

            try (RevWalk walk = new RevWalk(repositoryGit)) {
                ObjectId branchId = repositoryGit.resolve("refs/heads/" + branch);

                RevCommit commit = walk.parseCommit(branchId);
                RevTree tree = commit.getTree();
                System.out.println("Having tree: " + tree);

                // now use a TreeWalk to iterate over all files in the Tree recursively
                // you can set Filters to narrow down the results if needed
                try (TreeWalk treeWalk = new TreeWalk(repositoryGit)) {
                    treeWalk.addTree(tree);
                    treeWalk.setRecursive(true);

                    ObjectReader objectReader = treeWalk.getObjectReader();
                    while (treeWalk.next()) {
                        String fileName = treeWalk.getNameString();
                        String pathAndFileName = treeWalk.getPathString();
                        log.trace("tree         : {}", pathAndFileName);
                        log.trace("tree         : {}", new String(treeWalk.getRawPath(), StandardCharsets.UTF_8));
                        log.trace("tree filemode: {}", treeWalk.getFileMode());
                        log.trace("tree name    : {}", fileName);
                        log.trace("tree attribut: {}", treeWalk.getAttributes());
                        String extension = extractExtension(fileName);
                        ObjectLoader loader = null;
                        try {
                            ObjectId currentObjectId = treeWalk.getObjectId(0);
                            loader = objectReader.open(currentObjectId, OBJ_BLOB);

                        } catch (IOException e) {
                            log.error("IOException while opening currentObjectId {}", pathAndFileName, e);
                            log.error("isSubtree {}", treeWalk.isSubtree());
                            continue;
                        }
                        if (loader.getType() == org.eclipse.jgit.lib.Constants.OBJ_COMMIT) {

                        }
                        if (loader.getType() == OBJ_BLOB) {
                            long size = loader.getSize();

                            String content = null;

                            if (size > Constants.MAX_SIZE_FOR_INDEXING_ONE_FILE
                                    || isFileInExclusion(workingDir.resolve(pathAndFileName))) {
                                log.trace("parsing only name on file : {}", pathAndFileName);
                            } else {
                                byte[] bytes = loader.getBytes();
                                content = new String(bytes, StandardCharsets.UTF_8);
                                log.trace("tree size    : {}", loader.getSize());
                            }
                            String pathComplet = this.repository.getPath() + "@" + branch + ":/" + pathAndFileName;
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

                    }
                } catch (Exception e) {
                    log.error("exception ", e);
                }

                //if there are some files not indexed, run once last time permit indexing last files
                log.debug("last indexing");
                indexingBulkFiles();
            }

        } catch (final IOException e) {
            log.error("Exception in crawler method", e);
        } finally {
            this.crawling = false;
        }
    }

    @Override
    public CrawlerResult start() {
        this.crawling = true;
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
        return this.crawling;
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
        Path workingDir = Paths.get(klaskProperties.getCrawler().getWorkingDirectory());
        workingDir.toFile().mkdirs();
        Path pathRepo = Paths.get(workingDir.toAbsolutePath() + "/" + repository.getName());
        if (Files.exists(pathRepo)) {
            try (Git repoGit = Git.open(pathRepo.toFile())) {
                pullRepositoryGit(repoGit);
            } catch (GitAPIException | IOException e) {
                log.error("exception while opening git directory in {} : {}", pathRepo.toString(), e.getMessage(), e);
            }
        } else {

            String privatekey = klaskProperties.getCrawler().getPrivateKey();
            String userGit = klaskProperties.getCrawler().getUserGit();
            log.info("private Key : {}", privatekey);
            CredentialsProvider credentials =
            new UsernamePasswordCredentialsProvider( userGit, privatekey);
            String repositoryPath = repository.getPath();
            try (Git repoGit = Git.cloneRepository()
                //if gitlab, redefine the path with private key
                .setCredentialsProvider( credentials)
                .setURI(repositoryPath)
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

    @Override
    public long getRepositoryId() {
        return repository.getId();
    }
}
