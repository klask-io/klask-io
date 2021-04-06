package io.klask.service.util;

import io.klask.config.Constants;
import io.klask.crawler.impl.FileSystemCrawler;
import io.klask.service.util.AESUtil;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.BadPaddingException;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.inject.Inject;
import java.security.InvalidAlgorithmParameterException;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.spec.InvalidKeySpecException;

public class CipherUtil {


    private final static  Logger log = LoggerFactory.getLogger(CipherUtil.class);
    private SecretKey secretKey;

    private static boolean activated = false;

    private static SecretKey key;
    private static IvParameterSpec ivParameterSpec;

    static {
        String masterAESKey = System.getenv(Constants.MASTER_AES_KEY);
        if (!StringUtils.isEmpty(masterAESKey) ){
            activated=true;
            String salt = "+sel_de_guérande+";
            ivParameterSpec = new IvParameterSpec(new byte[]{-57, 46, 113, -69, -72, -87, 108, -20, 4, -44, -95, -94, -87, -46, -9, 77});
            try {
                key = AESUtil.getKeyFromPassword(masterAESKey,salt);
            } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
                log.error("exception in cipherTextIfAESActivated : ", e);
            }
        }

    }

    public static String cipherTextIfAESActivated(String plainText) {
        if(activated) {
            try {
                return AESUtil.encryptPasswordBased(plainText, key, ivParameterSpec);
            } catch (NoSuchAlgorithmException | NoSuchPaddingException | InvalidAlgorithmParameterException | InvalidKeyException | BadPaddingException | IllegalBlockSizeException e) {
                log.error("exception in cipherTextIfAESActivated : ", e);
                return plainText;
            }
        }
        else
            return plainText;
    }


    public static String decipherTextIfAESActivated(String potentialCipheredText) {
        if(activated) {
            try {
                return AESUtil.decryptPasswordBased(potentialCipheredText, key, ivParameterSpec);
            } catch (NoSuchAlgorithmException | NoSuchPaddingException | InvalidAlgorithmParameterException | InvalidKeyException | BadPaddingException | IllegalBlockSizeException e) {
                log.error("exception in cipherTextIfAESActivated : ", e);
                return potentialCipheredText;
            }
        }
        else
            return potentialCipheredText;
    }

}
