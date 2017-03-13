package io.klask.domain.enumeration;

import java.util.Arrays;

/**
 * The RepositoryType enumeration.
 */
public enum RepositoryType {
    SVN, FILE_SYSTEM, GIT;

    public static String[] getAllTypes() {
        return (String[]) Arrays.asList("SVN", "FILE_SYSTEM", "GIT").toArray();
//        return (String[])Arrays.stream(RepositoryType.values())
//            .map(Enum::name)
//            .collect(Collectors.toList()).toArray();
    }
}
