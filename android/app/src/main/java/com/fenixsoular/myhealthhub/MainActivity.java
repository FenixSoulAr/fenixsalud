package com.fenixsoular.myhealthhub;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Enable edge-to-edge for all Android versions.
        // On Android 15 (SDK 35) this is automatic, but this call ensures
        // consistent behavior on Android 13/14 and older.
        EdgeToEdge.enable(this);

        super.onCreate(savedInstanceState);

        // Apply system bar insets as padding to the root content view.
        // This prevents content from being hidden behind the status bar
        // or navigation bar (both gesture nav and 3-button nav).
        ViewCompat.setOnApplyWindowInsetsListener(
            findViewById(android.R.id.content),
            (view, windowInsets) -> {
                Insets insets = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                return WindowInsetsCompat.CONSUMED;
            }
        );
    }
}
