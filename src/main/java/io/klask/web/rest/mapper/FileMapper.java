package io.klask.web.rest.mapper;

/**
 * Created by jeremie on 10/07/16.
 */
public class FileMapper {

    public static String getMappingContentType(String extension) {
        if (extension == null)
            return "markdown";
        switch (extension) {
            case "java":
            case "scala":
                return "java";
            case "md":
            case "txt":
                return "markdown";
            case "as":
                return "actionscript";
            case "py":
                return "python";
            case "go":
                return "go";
            case "xml":
            case "pom":
            case "html":
            case "htm":
            case "mathml":
            case "svg":
            case "jsp":
            case "dtd":
            case "mxml":
            case "xsl":
            case "xslt":
            case "tld":
            case "asp":
            case "jrxml":
                return "markup";
            case "json":
                return "json";
            case "yml":
            case "yaml":
                return "yaml";
            case "properties":
            case "conf":
            case "desc":
                return "properties";
            case "sql":
                return "sql";
            case "css":
            case "less":
            case "scss":
                return "css";
            case "js":
            case "javascript":
            case "gs":
                return "javascript";
            case "makefile":
            case "sh":
            case "zsh":
            case "bsh":
            case "bat":
                return "bash";
            case "php":
                return "php";
            default:
            case "cpp":
            case "c":
            case "h":
            case "pc":
            case "asm":
                return "clike";

        }

    }
}
