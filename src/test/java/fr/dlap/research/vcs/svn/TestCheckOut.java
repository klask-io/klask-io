package fr.dlap.research.vcs.svn;

import org.tmatesoft.svn.core.*;
import org.tmatesoft.svn.core.internal.io.dav.DAVRepositoryFactory;
import org.tmatesoft.svn.core.io.SVNRepository;
import org.tmatesoft.svn.core.io.SVNRepositoryFactory;
import org.tmatesoft.svn.core.wc.SVNClientManager;
import org.tmatesoft.svn.core.wc.SVNRevision;
import org.tmatesoft.svn.core.wc.SVNUpdateClient;
import org.tmatesoft.svn.core.wc.SVNWCUtil;

import java.io.File;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

/**
 * Created by jeremie on 11/01/17.
 */
public class TestCheckOut {

    private static Set<String> motsClefsSVN = new HashSet<>(Arrays.asList("trunk", "branches", "tags"));

    private static String TAGS = "tags";

    /**
     * Méthode traverse.<br>
     * Rôle :
     *
     * @param updateClient
     * @param repository
     * @param checkoutRootPath
     * @param destRootPath
     * @param repoPath
     * @param evictTags        : si on tombe une première fois sur trunk, branches ou tags, alors on n'élague plus les nouvelles occurrences rencontrées
     * @throws SVNException
     */
    public static void traverse(final SVNUpdateClient updateClient, final SVNRepository repository, final String checkoutRootPath, final String destRootPath, final String repoPath,
                                final boolean evictTags) throws SVNException {

        System.out.println(repoPath);

        if (!evictTags) {
            checkout(updateClient, checkoutRootPath, destRootPath, repoPath, SVNDepth.INFINITY);
        } else {
            checkout(updateClient, checkoutRootPath, destRootPath, repoPath, SVNDepth.FILES);

            final Collection<SVNDirEntry> entries = repository.getDir(repoPath, -1, null, (Collection) null);
            for (final SVNDirEntry entry : entries) {
                if (entry.getKind() != SVNNodeKind.DIR) {
                    continue;
                }
                boolean copieEvict = evictTags;

                if (motsClefsSVN.contains(entry.getName())) {
                    copieEvict = false;
                }
                //si on doit encore passer le niveau tags/branches/trunk et que le rép courant n'est pas tags, alors on poursuit
                if (!entry.getName().equalsIgnoreCase(TAGS)) {
                    traverse(
                        updateClient,
                        repository,
                        checkoutRootPath,
                        destRootPath,
                        repoPath.equals("") ? entry.getName() : repoPath + "/" + entry.getName(),
                        copieEvict);
                }
            }
        }
    }

    private static void checkout(final SVNUpdateClient updateClient, final String checkoutRootPath, final String destRootPath, final String repoPath, final SVNDepth depth) {
        //    updateClient.doExport(
        //        SVNURL.parseURIDecoded(checkoutRootPath + "/" + repoPath),
        //        new File(destRootPath + (!repoPath.isEmpty() ? "/" : "") + repoPath),
        //        SVNRevision.UNDEFINED,
        //        SVNRevision.HEAD,
        //        null,
        //        true,
        //        depth);

        try {
            updateClient.doCheckout(
                SVNURL.parseURIDecoded(checkoutRootPath + "/" + repoPath),
                new File(destRootPath + (!repoPath.isEmpty() ? "/" : "") + repoPath),
                SVNRevision.UNDEFINED,
                SVNRevision.HEAD,
                depth,
                true);
        } catch (final SVNException e) {
            System.err.println("Exception sur le fichier " + checkoutRootPath + "/" + repoPath);
            System.err.println(e.getMessage());
        }
    }

    //@Test
    public void checkoutTest() throws SVNException {
        String checkoutPath = "svn://localhost";
        String username = "integration";
        String password = "integration";
        String checkoutRootPath = new File("/home/jeremie/Developpement/checkoutsvn").getAbsolutePath();

        DAVRepositoryFactory.setup();

        final SVNRepository repository = SVNRepositoryFactory.create(SVNURL.parseURIDecoded(checkoutPath));
        repository.setAuthenticationManager(SVNWCUtil.createDefaultAuthenticationManager(username, password));

        final SVNClientManager clientManager = SVNClientManager.newInstance(null, repository.getAuthenticationManager());
        final SVNUpdateClient updateClient = clientManager.getUpdateClient();

        updateClient.setIgnoreExternals(false);

        final SVNNodeKind nodeKind = repository.checkPath("", -1);

        if (nodeKind == SVNNodeKind.NONE) {
            System.err.println("There is no entry at '" + checkoutPath + "'.");
            System.exit(1);
        } else if (nodeKind == SVNNodeKind.FILE) {
            System.err.println("The entry at '" + checkoutPath + "' is a file while a directory was expected.");
            System.exit(1);
        }
        System.out.println("*** CHECKOUT SVN Trunk/Branches ***");
        System.out.println("Checkout source: " + checkoutPath);
        System.out.println("Checkout destination: " + checkoutRootPath);
        System.out.println("...");
        try {
            traverse(updateClient, repository, checkoutPath, checkoutRootPath, "", true);
        } catch (final Exception e) {
            System.err.println("ERROR : " + e.getMessage());
            e.printStackTrace(System.err);
            System.exit(-1);
        }
        System.out.println("");
        System.out.println("Repository latest revision: " + repository.getLatestRevision());
    }

}
