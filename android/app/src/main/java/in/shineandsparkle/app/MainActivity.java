package in.shineandsparkle.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Prevent WebView from extending behind system bars (status bar + nav bar).
        // Required on Android 15+ (targetSdk 35) where edge-to-edge is enforced,
        // and recommended on targetSdk 34 to avoid layout bleed-through in Capacitor.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
