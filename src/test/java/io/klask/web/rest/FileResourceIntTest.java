package io.klask.web.rest;

import io.klask.KlaskApp;
import io.klask.domain.File;
import io.klask.repository.search.CustomSearchRepository;
import io.klask.repository.search.FileSearchRepository;
import io.klask.service.IndexService;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.mockito.MockitoAnnotations;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.PostConstruct;
import javax.inject.Inject;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;


/**
 * Test class for the FileResource REST controller.
 *
 * @see FileResource
 */
@RunWith(SpringJUnit4ClassRunner.class)
@SpringBootTest(classes = KlaskApp.class)
@WebAppConfiguration
public class FileResourceIntTest {

    private static final String DEFAULT_NAME = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    private static final String DEFAULT_PATH = "AAAAA";

    private static final String DEFAULT_CONTENT = "AAAAA";
    private static final String DEFAULT_VERSION = "AAAAA";

    @Inject
    private FileSearchRepository fileSearchRepository;

    @Inject
    private CustomSearchRepository customSearchRepository;

    @Inject
    private MappingJackson2HttpMessageConverter jacksonMessageConverter;

    @Inject
    private PageableHandlerMethodArgumentResolver pageableArgumentResolver;

    @Inject
    private IndexService indexService;

    private MockMvc restFileMockMvc;

    private File file;

    @PostConstruct
    public void setup() {
        MockitoAnnotations.initMocks(this);
        FileResource fileResource = new FileResource();
        ReflectionTestUtils.setField(fileResource, "fileSearchRepository", fileSearchRepository);
        ReflectionTestUtils.setField(fileResource, "customSearchRepository", customSearchRepository);
        this.restFileMockMvc = MockMvcBuilders.standaloneSetup(fileResource)
            .setCustomArgumentResolvers(pageableArgumentResolver)
            .setMessageConverters(jacksonMessageConverter).build();
        indexService.initIndexes();
    }

    @Before
    public void initTest() {
        fileSearchRepository.deleteAll();
        file = new File(UUID.randomUUID().toString(), DEFAULT_NAME, null, DEFAULT_PATH, null, DEFAULT_CONTENT, DEFAULT_VERSION, 0L);
    }

//    @Test
//    @Transactional
//    public void createFile() throws Exception {
//        long databaseSizeBeforeCreate = fileSearchRepository.count();
//
//        // Create the File
//
//        restFileMockMvc.perform(post("/api/files")
//            .contentType(TestUtil.APPLICATION_JSON_UTF8)
//            .content(TestUtil.convertObjectToJsonBytes(file)))
//            .andExpect(status().isCreated());
//
//        // Validate the File in the database
//        Iterable<File> files = fileSearchRepository.findAll();
//        assertThat(files).hasSize((int) databaseSizeBeforeCreate + 1);
//        File testFile = null;
//        for (File f : files) {
//            testFile = f;
//        }
//        assertThat(testFile.getName()).isEqualTo(DEFAULT_NAME);
//        assertThat(testFile.getPath()).isEqualTo(DEFAULT_PATH);
//        assertThat(testFile.getContent()).isEqualTo(DEFAULT_CONTENT);
//        assertThat(testFile.getVersion()).isEqualTo(DEFAULT_VERSION);
//
//        // Validate the File in ElasticSearch
//        File fileEs = fileSearchRepository.findOne(testFile.getId());
//        assertThat(fileEs).isEqualToComparingFieldByField(testFile);
//    }

    @Test
    @Transactional
    public void checkNameIsRequired() throws Exception {
    	Page<File> fichiers = fileSearchRepository.findAll(new PageRequest(0, 1000));

    	int databaseSizeBeforeTest = fichiers.getNumber();
        // set the field null
        file.setName(null);

        // Create the File, which fails.

        restFileMockMvc.perform(post("/api/files")
                .contentType(TestUtil.APPLICATION_JSON_UTF8)
                .content(TestUtil.convertObjectToJsonBytes(file)))
                .andExpect(status().isBadRequest());

        Page<File> files = fileSearchRepository.findAll(new PageRequest(0, 1000));
        assertThat(files).hasSize(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    public void checkPathIsRequired() throws Exception {
    	Page<File> fichiers = fileSearchRepository.findAll(new PageRequest(0, 1000));
        int databaseSizeBeforeTest = fichiers.getNumber();
        // set the field null
        file.setPath(null);

        // Create the File, which fails.

        restFileMockMvc.perform(post("/api/files")
                .contentType(TestUtil.APPLICATION_JSON_UTF8)
                .content(TestUtil.convertObjectToJsonBytes(file)))
                .andExpect(status().isBadRequest());

        Page<File> files = fileSearchRepository.findAll(new PageRequest(0, 1000));
        assertThat(files).hasSize(databaseSizeBeforeTest);
    }

    @Test
    @Transactional
    public void getAllFiles() throws Exception {
        // Initialize the database
        fileSearchRepository.save(file);


        // Get all the files
        restFileMockMvc.perform(get("/api/files?sort=id,desc"))
                .andExpect(status().isOk())
            .andExpect(content().contentType(MediaType.APPLICATION_JSON_UTF8))
                .andExpect(jsonPath("$.[*].id").value(hasItem(file.getId().toString())))
                .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME.toString())))
                .andExpect(jsonPath("$.[*].path").value(hasItem(DEFAULT_PATH.toString())))
                .andExpect(jsonPath("$.[*].content").value(hasItem(DEFAULT_CONTENT.toString())))
                .andExpect(jsonPath("$.[*].version").value(hasItem(DEFAULT_VERSION.toString())));
    }

//
//    @Test
//    @Transactional
//    public void getFile() throws Exception {
//        // Initialize the database
//        fileSearchRepository.saveAndFlush(file);
//
//        // Get the file
//        restFileMockMvc.perform(get("/api/files/{id}", file.getId()))
//            .andExpect(status().isOk())
//            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
//            .andExpect(jsonPath("$.id").value(file.getId().intValue()))
//            .andExpect(jsonPath("$.name").value(DEFAULT_NAME.toString()))
//            .andExpect(jsonPath("$.path").value(DEFAULT_PATH.toString()))
//            .andExpect(jsonPath("$.content").value(DEFAULT_CONTENT.toString()))
//            .andExpect(jsonPath("$.version").value(DEFAULT_VERSION.toString()));
//    }
//
//    @Test
//    @Transactional
//    public void getNonExistingFile() throws Exception {
//        // Get the file
//        restFileMockMvc.perform(get("/api/files/{id}", Long.MAX_VALUE))
//                .andExpect(status().isNotFound());
//    }
//
//    @Test
//    @Transactional
//    public void updateFile() throws Exception {
//        // Initialize the database
//        fileRepository.saveAndFlush(file);
//        fileSearchRepository.save(file);
//        int databaseSizeBeforeUpdate = fileRepository.findAll().size();
//
//        // Update the file
//        File updatedFile = new File();
//        updatedFile.setId(file.getId());
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
//        fileRepository.saveAndFlush(file);
//        fileSearchRepository.save(file);
//        int databaseSizeBeforeDelete = fileRepository.findAll().size();
//
//        // Get the file
//        restFileMockMvc.perform(delete("/api/files/{id}", file.getId())
//                .accept(TestUtil.APPLICATION_JSON_UTF8))
//                .andExpect(status().isOk());
//
//        // Validate ElasticSearch is empty
//        boolean fileExistsInEs = fileSearchRepository.exists(file.getId());
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
//        fileRepository.saveAndFlush(file);
//        fileSearchRepository.save(file);
//
//        // Search the file
//        restFileMockMvc.perform(get("/api/_search/files?query=id:" + file.getId()))
//            .andExpect(status().isOk())
//            .andExpect(content().contentType(MediaType.APPLICATION_JSON))
//            .andExpect(jsonPath("$.[*].id").value(hasItem(file.getId().intValue())))
//            .andExpect(jsonPath("$.[*].name").value(hasItem(DEFAULT_NAME.toString())))
//            .andExpect(jsonPath("$.[*].path").value(hasItem(DEFAULT_PATH.toString())))
//            .andExpect(jsonPath("$.[*].content").value(hasItem(DEFAULT_CONTENT.toString())))
//            .andExpect(jsonPath("$.[*].version").value(hasItem(DEFAULT_VERSION.toString())));
//    }
}
