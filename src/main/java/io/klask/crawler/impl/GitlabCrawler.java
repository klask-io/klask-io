package io.klask.crawler.impl;

import io.klask.config.Constants;
import io.klask.config.KlaskProperties;
import io.klask.crawler.CrawlerResult;
import io.klask.crawler.ICrawler;
import io.klask.domain.File;
import io.klask.domain.GitlabProject;
import io.klask.domain.Repository;
import lombok.extern.slf4j.Slf4j;

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
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import static org.eclipse.jgit.lib.Constants.OBJ_BLOB;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Future;
import java.util.stream.Stream;

@Slf4j
public class GitlabCrawler extends GenericCrawler implements ICrawler {

    private final RestTemplate rt = new RestTemplate();

    public GitlabCrawler(Repository repository, KlaskProperties klaskProperties,
            ElasticsearchTemplate elasticsearchTemplate) {
        super(repository, klaskProperties, elasticsearchTemplate);
    }

    @Override
    public CrawlerResult start() {

        initializeProperties();

        try {
            retrieveGitlabProjects()
                .forEach(prj -> {
                    try(Git repoGit = this.checkoutRepoGit(prj);) {

                        getRemoteBranches(repoGit).stream()
                            .map(this::extractBranchName)
                            .forEach(branchName->  {
                                Ref branchHeadRef = checkoutBranche(branchName, repoGit);
                                if (branchHeadRef != null) {
                                    indexFilesInCurrentBranch(prj, repoGit, branchName, branchHeadRef);
                                }
                            });
                    } catch (GitAPIException | IOException e) {
                        log.error("Exception in crawler method", e);
                    }
                });
        } catch (RestClientException e) {
            log.error("Error calling Gitlab API", e);
        }
        return null;
    }

    private List<GitlabProject> retrieveGitlabProjects() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Private-Token", repository.getPassword());

        HttpEntity<String> request = new HttpEntity<>(headers);

        String nextPage= "1";
        String path = repository.getPath() + "/api/v4/projects?simple=true&per_page=100&page=";

        List<GitlabProject> projects = new ArrayList<>();
        while (nextPage != null && !nextPage.isEmpty() ) {
            ResponseEntity<List<GitlabProject>> response = rt.exchange(path + nextPage, HttpMethod.GET, request , new ParameterizedTypeReference<List<GitlabProject>>() {});
            projects.addAll(response.getBody());
            nextPage = response.getHeaders().get("X-Next-Page").get(0);
        }
        return projects;
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

    private Git checkoutRepoGit(GitlabProject project) throws IOException, GitAPIException {
        Path workingDir = Paths.get(klaskProperties.getCrawler().getWorkingDirectory());
        workingDir.toFile().mkdirs();

        Path pathRepo = workingDir.toAbsolutePath().resolve(project.getName());
        if (Files.exists(pathRepo)) {
            return Git.open(pathRepo.toFile());
        } else {
            CredentialsProvider credentials = new UsernamePasswordCredentialsProvider(repository.getUsername(),
                    repository.getPassword());

            return Git.cloneRepository()
                .setCredentialsProvider(credentials)
                .setURI(project.getUrl())
                .setDirectory(pathRepo.toFile())
                .setCloneSubmodules(true)
                .setCloneAllBranches(true)
                .call();
        }
    }

    private List<Ref> getRemoteBranches(Git repoGit) throws GitAPIException {
        return repoGit.branchList().setListMode(ListBranchCommand.ListMode.REMOTE).call();
    }

    /**
     * @return A reference to the branch head in the local repository
     */
    private Ref checkoutBranche(String branchName, Git repoGit) {

        try {
            boolean createBranch = !ObjectId.isId(branchName);
            if (createBranch) {
                Ref ref = repoGit.getRepository().exactRef("refs/heads/" + branchName);
                if (ref != null) {
                    createBranch = false;
                }
            }
            return repoGit.checkout()
                .setCreateBranch(createBranch)
                .setName(branchName)
                .call();


        } catch (IOException | GitAPIException e) {
            log.error("git checkout branch exception : {}", e.getMessage(), e);
            return null;
        }
    }

    private String extractBranchName(Ref remoteBranch) {
        String name = remoteBranch.getName();
        return name.substring(name.lastIndexOf('/') + 1);
    }

    private void indexFilesInCurrentBranch(GitlabProject project, Git git, String branch, Ref branchRef) {
        org.eclipse.jgit.lib.Repository repositoryGit = git.getRepository();
        Path workingDir = repositoryGit.getWorkTree().toPath();
        try(RevWalk walk = new RevWalk(repositoryGit)) {
            log.info("Project = {} - Branch = {} - Files to index = {}", project.getName(), branch,
                    calculateFilesToIndex(workingDir));

            RevCommit commit = walk.parseCommit(branchRef.getObjectId());
            RevTree tree = commit.getTree();

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

                    if (loader.getType() == OBJ_BLOB) {
                        long size = loader.getSize();

                        String content = null;

                        if ((!readableExtensionSet.contains(extension) && !"".equals(extension))
                            || size > Constants.MAX_SIZE_FOR_INDEXING_ONE_FILE) {
                            log.trace("parsing only name on file : {}", pathAndFileName);
                        } else {
                            content = new String(loader.getBytes(), StandardCharsets.UTF_8);
                            log.trace("tree size    : {}", loader.getSize());
                        }
                        String projectPath = project.getUrl().substring(0, project.getUrl().lastIndexOf(".git"));
                        String pathComplet = projectPath + "/-/blob/" + branch + "/" + pathAndFileName;
                        //sha3 on the file's path. It should be the same, even after a full reindex
                        SHA256.Digest md = new SHA256.Digest();
                        md.update(pathComplet.getBytes(StandardCharsets.UTF_8));

                        File fichier = new File(
                            Hex.toHexString(md.digest()),
                            fileName,
                            extension,
                            pathComplet,
                            project.getName(),
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

        } catch (final IOException e) {
            log.error("Exception in crawler method", e);
        }
    }

    private long calculateFilesToIndex(Path workingDir) throws IOException {
        try (Stream<Path> walk = Files.walk(workingDir)) {
            return walk
                    .filter(dir -> !this.excludeDirectories(workingDir, dir))
                    .filter(file -> file.toFile().isFile())
                    .filter(file -> !this.isFileInExclusion(file))
                    .count();
        }
    }

}
