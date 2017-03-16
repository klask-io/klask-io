package io.klask.web.rest;

import io.klask.KlaskApp;
import io.klask.domain.File;
import io.klask.repository.search.CustomSearchRepository;
import io.klask.repository.search.FileSearchRepository;
import io.klask.web.rest.dto.VersionDTO;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.MockitoAnnotations;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import javax.annotation.PostConstruct;
import javax.inject.Inject;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;


/**
 * Test class for the FileResource REST controller.
 *
 * @see FileResource
 */
@RunWith(SpringJUnit4ClassRunner.class)
@SpringBootTest(classes = KlaskApp.class)
@WebAppConfiguration
public class VersionResourceIntTest {

    private static final String DEFAULT_NAME = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    private static final String UPDATED_NAME = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    private static final String DEFAULT_PATH = "AAAAA";
    private static final String UPDATED_PATH = "BBBBB";

    private static final String DEFAULT_CONTENT = "AAAAA";
    private static final String UPDATED_CONTENT = "BBBBB";
    private static final String DEFAULT_VERSION = "AAAAA";
    private static final String VERSION_1 = "BBBBB";
    private static final String VERSION_2 = "CCCCC";
    private static final String VERSION_3 = "DDDDD";

    @Inject
    private CustomSearchRepository customSearchRepository;

    @Inject
    private MappingJackson2HttpMessageConverter jacksonMessageConverter;

    @Inject
    private PageableHandlerMethodArgumentResolver pageableArgumentResolver;

    @Inject
    private FileSearchRepository fileSearchRepository;

    private MockMvc restFileMockMvc;

    private List<VersionDTO> versions;

    private File file;

    @PostConstruct
    public void setup() {
        MockitoAnnotations.initMocks(this);
        VersionResource versionResource = new VersionResource();
        ReflectionTestUtils.setField(versionResource, "customSearchRepository", customSearchRepository);
        this.restFileMockMvc = MockMvcBuilders.standaloneSetup(versionResource)
            .setCustomArgumentResolvers(pageableArgumentResolver)
            .setMessageConverters(jacksonMessageConverter).build();

    }

    @Before
    public void initTest() {
        fileSearchRepository.deleteAll();
        file = new File(UUID.randomUUID().toString(), DEFAULT_NAME, null, DEFAULT_PATH, null, DEFAULT_CONTENT, DEFAULT_VERSION, 0L);


    }


    @Test
    public void checkAggregate() throws Exception {

        // Create the File, which fails.
        fileSearchRepository.save(file);

        restFileMockMvc.perform(get("/api/versions")
            .accept(TestUtil.APPLICATION_JSON_UTF8))
            .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_UTF8))
            .andExpect(jsonPath("$.[*].name").value(DEFAULT_VERSION))
            .andExpect(jsonPath("$.[*].docNumber").value(1));
    }

    @Test
    public void checkTwoFilesWithTwoVersions() throws Exception {
        //second file
        file.setId(UUID.randomUUID().toString());
        file.setVersion(VERSION_1);
        fileSearchRepository.save(file);

        //third file
        file.setId(UUID.randomUUID().toString());
        file.setVersion(VERSION_2);
        fileSearchRepository.save(file);

        restFileMockMvc.perform(get("/api/versions")
            .accept(TestUtil.APPLICATION_JSON_UTF8))
            .andExpect(status().isOk())
            //.andDo(mvcResult -> System.out.println(mvcResult.getResponse().getContentAsString()))
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_UTF8))
            .andExpect(jsonPath("$.[*].name").value(not(DEFAULT_VERSION)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(VERSION_1)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(VERSION_2)))
            .andExpect(jsonPath("$.[*].docNumber").value(hasItem(1)))
            .andExpect(jsonPath("$").value(hasSize(2)));
        //[{"name":"BBBBB","docNumber":1},{"name":"CCCCC","docNumber":1}]
    }

    @Test
    public void checkTwoFilesWithSameVersion() throws Exception {
        //first file
        file.setId(UUID.randomUUID().toString());
        file.setVersion(VERSION_1);
        fileSearchRepository.save(file);

        //second file
        file.setId(UUID.randomUUID().toString());
        file.setVersion(VERSION_1);
        file.setContent("DIFFERENT");
        file.setName("OTHER NAME");
        file.setPath("OTHER/PATH");
        fileSearchRepository.save(file);

        restFileMockMvc.perform(get("/api/versions")
            .accept(TestUtil.APPLICATION_JSON_UTF8))
            .andExpect(status().isOk())
            //.andDo(mvcResult -> System.out.println(mvcResult.getResponse().getContentAsString()))
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_UTF8))
            .andExpect(jsonPath("$.[*].name").value(not(DEFAULT_VERSION)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(VERSION_1)))
            .andExpect(jsonPath("$.[*].name").value(not(VERSION_2)))
            .andExpect(jsonPath("$.[*].docNumber").value(hasItem(2)))
            .andExpect(jsonPath("$").value(hasSize(1)));
        //[{"name":"BBBBB","docNumber":2}]
    }

    @Test
    public void checkWithLowerAndUpperCase() throws Exception {
        //first file
        fileSearchRepository.save(file);

        //second file
        file.setId(UUID.randomUUID().toString());
        file.setVersion(DEFAULT_VERSION.toLowerCase());
        fileSearchRepository.save(file);

        restFileMockMvc.perform(get("/api/versions")
            .accept(TestUtil.APPLICATION_JSON_UTF8))
            .andExpect(status().isOk())
            //.andDo(mvcResult -> System.out.println(mvcResult.getResponse().getContentAsString()))
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_UTF8))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_VERSION)))
            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_VERSION.toLowerCase())))
            .andExpect(jsonPath("$.[*].docNumber").value(hasItem(1)))//each version has 1 document
            .andExpect(jsonPath("$").value(hasSize(2)));//two versions differents
        //[{"name":"AAAAA","docNumber":1},{"name":"aaaaa","docNumber":1}]
    }

    //@Test
    public void badRequest() throws Exception {
        //first file
        fileSearchRepository.save(file);

        restFileMockMvc.perform(get("/api/versions?query=version:null:null")
            .accept(TestUtil.APPLICATION_JSON_UTF8))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("all shards failed : Failed to parse query [version:null:null]"));
    }

/*
    @Test
    @Transactional
    public void checkPathIsRequired() throws Exception {
    	Page<File> fichiers = fileSearchRepository.findAll(new PageRequest(0, 1000));
        int databaseSizeBeforeTest = fichiers.getNumber();
        // set the field null
        versions.setPath(null);

        // Create the File, which fails.

        restFileMockMvc.perform(post("/api/files")
                .contentType(TestUtil.APPLICATION_JSON_UTF8)
                .content(TestUtil.convertObjectToJsonBytes(versions)))
                .andExpect(status().isBadRequest());

        Page<File> files = fileSearchRepository.findAll(new PageRequest(0, 1000));
        assertThat(files).hasSize(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    public void getAllFiles() throws Exception {
        // Initialize the database
        fileSearchRepository.save(versions);


        // Get all the files
        restFileMockMvc.perform(get("/api/files?sort=id,desc"))
                .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_UTF8))
                .andExpect(jsonPath("$.[*].id").value(hasItem(versions.getId().toString())))
                .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME.toString())))
                .andExpect(jsonPath("$.[*].path").value(hasItem(DEFAULT_PATH.toString())))
                .andExpect(jsonPath("$.[*].content").value(hasItem(DEFAULT_CONTENT.toString())))
                .andExpect(jsonPath("$.[*].version").value(hasItem(DEFAULT_VERSION.toString())));
    }*/

//
//    @Test
//    @Transactional
//    public void getFile() throws Exception {
//        // Initialize the database
//        fileSearchRepository.saveAndFlush(versions);
//
//        // Get the versions
//        restFileMockMvc.perform(get("/api/files/{id}", versions.getId()))
//            .andExpect(status().isOk())
//            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
//            .andExpect(jsonPath("$.id").value(versions.getId().intValue()))
//            .andExpect(jsonPath("$.name").value(DEFAULT_NAME.toString()))
//            .andExpect(jsonPath("$.path").value(DEFAULT_PATH.toString()))
//            .andExpect(jsonPath("$.content").value(DEFAULT_CONTENT.toString()))
//            .andExpect(jsonPath("$.version").value(DEFAULT_VERSION.toString()));
//    }
//
//    @Test
//    @Transactional
//    public void getNonExistingFile() throws Exception {
//        // Get the versions
//        restFileMockMvc.perform(get("/api/files/{id}", Long.MAX_VALUE))
//                .andExpect(status().isNotFound());
//    }
//
//    @Test
//    @Transactional
//    public void updateFile() throws Exception {
//        // Initialize the database
//        fileRepository.saveAndFlush(versions);
//        fileSearchRepository.save(versions);
//        int databaseSizeBeforeUpdate = fileRepository.findAll().size();
//
//        // Update the versions
//        File updatedFile = new File();
//        updatedFile.setId(versions.getId());
//        updatedFile.setName(UPDATED_NAME);
//        updatedFile.setPath(UPDATED_PATH);
//        updatedFile.setContent(UPDATED_CONTENT);
//        updatedFile.setVersion(UPDATED_VERSION);
//
//        restFileMockMvc.perform(put("/api/files")
//                .contentType(TestUtil.APPLICATION_JSON_UTF8)
//                .content(TestUtil.convertObjectToJsonBytes(updatedFile)))
//                .andExpect(status().isOk());
//
//        // Validate the File in the database
//        List<File> files = fileRepository.findAll();
//        assertThat(files).hasSize(databaseSizeBeforeUpdate);
//        File testFile = files.get(files.size() - 1);
//        assertThat(testFile.getName()).isEqualTo(UPDATED_NAME);
//        assertThat(testFile.getPath()).isEqualTo(UPDATED_PATH);
//        assertThat(testFile.getContent()).isEqualTo(UPDATED_CONTENT);
//        assertThat(testFile.getVersion()).isEqualTo(UPDATED_VERSION);
//
//        // Validate the File in ElasticSearch
//        File fileEs = fileSearchRepository.findOne(testFile.getId());
//        assertThat(fileEs).isEqualToComparingFieldByField(testFile);
//    }
//
//    @Test
//    @Transactional
//    public void deleteFile() throws Exception {
//        // Initialize the database
//        fileRepository.saveAndFlush(versions);
//        fileSearchRepository.save(versions);
//        int databaseSizeBeforeDelete = fileRepository.findAll().size();
//
//        // Get the versions
//        restFileMockMvc.perform(delete("/api/files/{id}", versions.getId())
//                .accept(TestUtil.APPLICATION_JSON_UTF8))
//                .andExpect(status().isOk());
//
//        // Validate ElasticSearch is empty
//        boolean fileExistsInEs = fileSearchRepository.exists(versions.getId());
//        assertThat(fileExistsInEs).isFalse();
//
//        // Validate the database is empty
//        List<File> files = fileRepository.findAll();
//        assertThat(files).hasSize(databaseSizeBeforeDelete - 1);
//    }
//
//    @Test
//    @Transactional
//    public void searchFile() throws Exception {
//        // Initialize the database
//        fileRepository.saveAndFlush(versions);
//        fileSearchRepository.save(versions);
//
//        // Search the versions
//        restFileMockMvc.perform(get("/api/_search/files?query=id:" + versions.getId()))
//            .andExpect(status().isOk())
//            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
//            .andExpect(jsonPath("$.[*].id").value(hasItem(versions.getId().intValue())))
//            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME.toString())))
//            .andExpect(jsonPath("$.[*].path").value(hasItem(DEFAULT_PATH.toString())))
//            .andExpect(jsonPath("$.[*].content").value(hasItem(DEFAULT_CONTENT.toString())))
//            .andExpect(jsonPath("$.[*].version").value(hasItem(DEFAULT_VERSION.toString())));
//    }
}
