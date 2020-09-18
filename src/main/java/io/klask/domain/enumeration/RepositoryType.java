package io.klask.domain.enumeration;

import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * The RepositoryType enumeration.
 */
public enum RepositoryType {
    SVN, FILE_SYSTEM, GIT, GITLAB;

    public static String[] getAllTypes() {
        return (String[])(Arrays.stream(RepositoryType.values())
            .map(Enum::name)
            .collect(Collectors.toList()).toArray(new String[0]));
    }
}
