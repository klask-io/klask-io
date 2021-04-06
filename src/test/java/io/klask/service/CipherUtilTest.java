package io.klask.service;

import io.klask.config.Constants;
import io.klask.service.util.CipherUtil;
import org.junit.*;
import uk.org.webcompere.systemstubs.rules.EnvironmentVariablesRule;

public class CipherUtilTest {

    @Rule
    public EnvironmentVariablesRule rule2 = new EnvironmentVariablesRule(
        Constants.MASTER_AES_KEY, "mon_master_password_aes");

    @Test
    public void testCipherText() {
        String plainText = "ceci_est_mon_mot_de_passe_non_chiffré";
        String cipherdText = CipherUtil.cipherTextIfAESActivated(plainText);
        String decipherdText = CipherUtil.decipherTextIfAESActivated(cipherdText);
        Assert.assertEquals(plainText, decipherdText);
    }

    @Test
    public void manualDecipher() {
        String cipherdText = "HxrGDw3oAVYzH5idiqrrr5L+zEK2V3amjYxEpA5nNte4KWT5A0d560i5SXFXpiAJ";
        String decipherdText = CipherUtil.decipherTextIfAESActivated(cipherdText);
        System.out.println(decipherdText);


    }

}
