package fr.dlap.research.config;

import java.util.HashMap;
import java.util.Map;

/**
 * Application constants.
 */
public final class Constants {

    //Regex for acceptable logins
    public static final String LOGIN_REGEX = "^[_'.@A-Za-z0-9-]*$";
    // Spring profile for development see http://jhipster.github.io/profiles/
    public static final String SPRING_PROFILE_DEVELOPMENT = "dev";
    // Spring profile for production
    public static final String SPRING_PROFILE_PRODUCTION = "prod";
    // Spring profile used when deploying with Spring Cloud (used when deploying to CloudFoundry)
    public static final String SPRING_PROFILE_CLOUD = "cloud";
    // Spring profile used when deploying to Heroku
    public static final String SPRING_PROFILE_HEROKU = "heroku";
    // Spring profile used to disable swagger
    public static final String SPRING_PROFILE_NO_SWAGGER = "no-swagger";
    // Spring profile used to disable running liquibase
    public static final String SPRING_PROFILE_NO_LIQUIBASE = "no-liquibase";
    // Account system
    public static final String SYSTEM_ACCOUNT = "system";
    // Index name in elasticsearch
    public static final String INDEX_NAME = "file";
    // Type in elasticsearch
    public static final String TYPE_NAME = "file";
    // Parameter 'index.max_result_window' in elasticsearch
    public static final int MAX_RESULT_SEARCH_WINDOW = 10000;
    // Fragments for results are truncated
    public static final int TRUNCATED_CONTENT = 200;
    // Default page size for results if the frontend doesn't specify
    public static final int PAGE_SIZE = 10;
    // Max size of a readable file to index 20Mo
    public static final long MAX_SIZE_FOR_INDEXING_ONE_FILE = 20 * 1024 * 1024;
    // Map of fields which give the raw field to sort (https://www.elastic.co/guide/en/elasticsearch/guide/current/multi-fields.html)
    public static final Map<String, String> ORDER_FIELD_MAPPING = new HashMap<>();

    static {
        ORDER_FIELD_MAPPING.put("id", "id");
        ORDER_FIELD_MAPPING.put("_score", "_score");
        ORDER_FIELD_MAPPING.put("size", "size");
        ORDER_FIELD_MAPPING.put("content", "content");
        ORDER_FIELD_MAPPING.put("name", "name.raw");
        ORDER_FIELD_MAPPING.put("version", "version.raw");
        ORDER_FIELD_MAPPING.put("extension", "extension.raw");
        ORDER_FIELD_MAPPING.put("path", "path.raw");
        ORDER_FIELD_MAPPING.put("project", "project.raw");

    }

    private Constants() {
    }
}
