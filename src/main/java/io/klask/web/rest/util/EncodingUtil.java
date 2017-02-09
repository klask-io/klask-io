package io.klask.web.rest.util;

import org.apache.commons.lang3.StringEscapeUtils;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.Charset;

/**
 * Created by jeremie on 27/06/16.
 */
public class EncodingUtil {

    private static final Logger log = LoggerFactory.getLogger(EncodingUtil.class);

    public static String convertToUTF8(String stringToConvert) {
        return StringUtils.toEncodedString(stringToConvert.getBytes(), Charset.forName("utf-8"));
    }

    public static String unEscapeString(String stringToUnEscape) {
        return StringEscapeUtils.unescapeHtml4(stringToUnEscape);
    }
}
