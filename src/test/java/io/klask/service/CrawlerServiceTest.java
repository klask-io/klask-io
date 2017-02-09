package io.klask.service;

import org.junit.Assert;
import org.junit.Test;

/**
 * Created by jeremie on 27/06/16.
 */
public class CrawlerServiceTest {


    @Test
    public void testExtractionPath() {
        String pathWithTrunk = "/home/jeremie/Developpement/svn/klask/trunk/src/main/java/io/klask/async/package-info.java";
        String pathwithBranches = "/home/jeremie/Developpement/svn/klask.test/branches/maint-15.3.x/src/main/webapp/bower_components/jquery/src/var/push.js";
        String pathWithoutTrunkOrBranches = "/home/jeremie/Developpement/svn/sib/fr/sib/sillage/productionDeSoins/fmPlanDeSoins/commande/ValidationGlobaleCommandeXML.java";
        String pathStartingwithTrunk = "trunk/sib/fr/sib/sillage/productionDeSoins/fmPlanDeSoins/commande/ValidationGlobaleCommandeXML.java";

        String version = findVersion(pathWithTrunk);
        Assert.assertEquals("trunk", version);

        version = findVersion(pathwithBranches);
        Assert.assertEquals("maint-15.3.x", version);

        version = findVersion(pathWithoutTrunkOrBranches);
        Assert.assertEquals("trunk", version);

        String project = findProject(pathWithTrunk);
        Assert.assertEquals("klask", project);

        project = findProject(pathwithBranches);
        Assert.assertEquals("klask.test", project);

        project = findProject(pathWithoutTrunkOrBranches);
        Assert.assertEquals(null, project);

        project = findProject(pathStartingwithTrunk);
        Assert.assertEquals(null, project);

    }


    private String findVersion(String path) {
        String version;
        if (path.contains("branches")) {
            int positionBranches = path.indexOf("/branches/");
            version = path.substring(positionBranches + 10, path.indexOf("/", positionBranches + 10));
        } else
            version = "trunk";
        return version;
    }


    private String findProject(String path) {
        String project = null;
        if (path.contains("branches")) {
            int positionBranches = path.indexOf("/branches/");
            if (positionBranches > 1) {
                project = path.substring(path.lastIndexOf("/", positionBranches - 1) + 1, positionBranches);
            }
        } else if (path.contains("trunk")) {
            int positionBranches = path.indexOf("/trunk/");
            if (positionBranches > 1) {
                project = path.substring(path.lastIndexOf("/", positionBranches - 1) + 1, positionBranches);
            }
        }

        return project;
    }


}
