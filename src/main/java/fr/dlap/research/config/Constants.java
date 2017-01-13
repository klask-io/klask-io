package fr.dlap.research.config;

/**
 * Application constants.
 */
public final class Constants {

    //Regex for acceptable logins
    public static final String LOGIN_REGEX = "^[_'.@A-Za-z0-9-]*$";
    // Spring profile for development and production, see http://jhipster.github.io/profiles/
    public static final String SPRING_PROFILE_DEVELOPMENT = "dev";
    public static final String SPRING_PROFILE_PRODUCTION = "prod";
    // Spring profile used when deploying with Spring Cloud (used when deploying to CloudFoundry)
    public static final String SPRING_PROFILE_CLOUD = "cloud";
    // Spring profile used when deploying to Heroku
    public static final String SPRING_PROFILE_HEROKU = "heroku";
    // Spring profile used to disable swagger
    public static final String SPRING_PROFILE_NO_SWAGGER = "no-swagger";
    // Spring profile used to disable running liquibase
    public static final String SPRING_PROFILE_NO_LIQUIBASE = "no-liquibase";
    //account system
    public static final String SYSTEM_ACCOUNT = "system";
    //index name in elasticsearch
    public static final String INDEX_NAME = "file";
    //type in elasticsearch
    public static final String TYPE_NAME = "file";
    //parameter 'index.max_result_window' in elasticsearch
    public static final int MAX_RESULT_SEARCH_WINDOW = 10000;
    //fragments for results are truncated
    public static final int TRUNCATED_CONTENT = 200;
    //default page size for results if the frontend doesn't specify
    public static final int PAGE_SIZE = 10;
    //max size of a readable file to index 20Mo
    public static final long MAX_SIZE_FOR_INDEXING_ONE_FILE = 20 * 1024 * 1024;

    private Constants() {
    }
}
