package io.klask.web.rest.util;

import java.nio.charset.StandardCharsets;

import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;

/**
 * Created by jeremie on 27/06/16.
 */
public class EncodingUtil {

    public static String convertToUTF8(String stringToConvert) {
        return StringUtils.toEncodedString(stringToConvert.getBytes(), StandardCharsets.UTF_8);
    }

    public static String unEscapeString(String stringToUnEscape) {
        return StringEscapeUtils.unescapeHtml4(stringToUnEscape);
    }
}
