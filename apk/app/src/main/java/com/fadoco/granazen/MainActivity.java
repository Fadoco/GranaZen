package com.fadoco.granazen;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(BackupFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
