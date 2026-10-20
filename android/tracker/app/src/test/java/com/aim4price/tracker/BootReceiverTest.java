package com.aim4price.tracker;
import android.Manifest;
import android.app.Application;
import android.content.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class BootReceiverTest {
 Application app;
 @Before public void setup(){app=RuntimeEnvironment.getApplication();TrackerApi.prefs(app).edit().clear().putString("token","a".repeat(64)).commit();}
 @Test public void pausedPhoneNeverStartsRecordingAtBoot(){new BootReceiver().onReceive(app,new Intent(Intent.ACTION_BOOT_COMPLETED));assertNull(shadowOf(app).getNextStartedService());}
 @Test public void activePhoneWithPermissionAttemptsRecovery(){shadowOf(app).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION);TrackerApi.prefs(app).edit().putBoolean("active",true).commit();new BootReceiver().onReceive(app,new Intent(Intent.ACTION_BOOT_COMPLETED));Intent service=shadowOf(app).getNextStartedService();assertNotNull(service);assertEquals(TrackingService.class.getName(),service.getComponent().getClassName());}
 @Test public void deniedLocationKeepsIntentButDoesNotClaimRecording(){shadowOf(app).denyPermissions(Manifest.permission.ACCESS_FINE_LOCATION);TrackerApi.prefs(app).edit().putBoolean("active",true).putBoolean("serviceRunning",true).commit();new BootReceiver().onReceive(app,new Intent(Intent.ACTION_BOOT_COMPLETED));assertNull(shadowOf(app).getNextStartedService());assertTrue(TrackerApi.prefs(app).getBoolean("active",false));assertFalse(TrackerApi.prefs(app).getBoolean("serviceRunning",true));assertTrue(TrackerApi.prefs(app).getString("issue","").contains("resume"));}
}
