package io.klask.crawler.svn;

import io.klask.crawler.impl.SVNCrawler;
import io.klask.domain.Repository;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import org.mockito.*;
import org.tmatesoft.svn.core.SVNException;
import org.tmatesoft.svn.core.io.diff.SVNDeltaProcessor;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * Created by harelj on 15/03/2017.
 */
//@RunWith(MockitoJUnitRunner.class)
public class SVNVisitorCrawlerTest {

    @Mock
    private SVNDeltaProcessor svnDeltaProcessor;

    @Mock
    private SvnProgressCanceller svnProgressCanceller;

    @Mock
    private SVNCrawler svnCrawler;

    @InjectMocks
    private SVNVisitorCrawler svnVisitorCrawler = new SVNVisitorCrawler(svnCrawler, svnProgressCanceller);



    @BeforeClass
    public static void setupClass(){
    }

    @Before
    public void setup(){
        MockitoAnnotations.initMocks(this);
    }

    /**
     * check if there is multiples svn keywords
     * @throws SVNException
     */
    @Test
    public void checkDoubleSVNHierarchyInPath() throws SVNException {
        Repository repoMock = new Repository();
        repoMock.setPath("svn://localhost");
        //when
        Mockito.when(svnCrawler.getRepository()).thenReturn(repoMock);
        Mockito.when(svnCrawler.isReadableExtension(Matchers.anyString())).thenReturn(true);

        this.svnVisitorCrawler.openRoot(1000);
        this.svnVisitorCrawler.addDir("/",null,-1);
        this.svnVisitorCrawler.addDir("/localhost", null, -1);
        this.svnVisitorCrawler.addDir("/localhost/trunk",null,-1);
        this.svnVisitorCrawler.addDir("/localhost/trunk/project",null,-1);
        this.svnVisitorCrawler.addDir("/localhost/trunk/project/path",null,-1);
        this.svnVisitorCrawler.addDir("/localhost/trunk/project/path/tags",null,-1);
        //then
        this.svnVisitorCrawler.addFile("/localhost/trunk/project/path/tags/file.txt", null, -1);
        this.svnVisitorCrawler.applyTextDelta("/localhost/trunk/project/path/tags/file.txt","chk");

        this.svnVisitorCrawler.closeDir();
        this.svnVisitorCrawler.closeDir();
        this.svnVisitorCrawler.closeDir();
        this.svnVisitorCrawler.closeDir();
        this.svnVisitorCrawler.closeDir();

        //given
        Mockito.verify(svnDeltaProcessor).applyTextDelta(Matchers.any(InputStream.class), Matchers.any(OutputStream.class), Matchers.anyBoolean());



    }
}
