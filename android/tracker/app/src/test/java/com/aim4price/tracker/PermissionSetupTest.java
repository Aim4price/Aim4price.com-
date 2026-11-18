package com.aim4price.tracker;

import android.Manifest;
import android.app.Activity;
import android.app.Application;
import android.content.pm.PackageManager;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class PermissionSetupTest {
 @Test public void setupRequestsOnlyMissingPermissionsAndKeepsRecordingPaused() {
  Application app = RuntimeEnvironment.getApplication();
  shadowOf(app).grantPermissions(Manifest.permission.ACCESS_FINE_LOCATION);
  shadowOf(app).denyPermissions(Manifest.permission.POST_NOTIFICATIONS);
  MainActivity activity = Robolectric.buildActivity(MainActivity.class).setup().get();
  activity.continuePermissionSetup();
  var request = shadowOf(activity).getLastRequestedPermission();
  assertArrayEquals(new String[]{Manifest.permission.POST_NOTIFICATIONS}, request.requestedPermissions);
  shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS);
  activity.onRequestPermissionsResult(request.requestCode, request.requestedPermissions, new int[]{PackageManager.PERMISSION_GRANTED});
  assertFalse(TrackerApi.prefs(app).getBoolean("active", false));
  assertNull(shadowOf(app).getNextStartedService());
 }

 @Test public void returningWithoutChangingLocationDoesNotReopenSettings() {
  Application app = RuntimeEnvironment.getApplication();
  shadowOf(app).denyPermissions(Manifest.permission.ACCESS_FINE_LOCATION);
  MainActivity activity = Robolectric.buildActivity(MainActivity.class).setup().get();
  activity.onActivityResult(MainActivity.SETTINGS_LOCATION, Activity.RESULT_CANCELED, null);
  assertNull(shadowOf(activity).getNextStartedActivityForResult());
  assertFalse(TrackerApi.prefs(app).getBoolean("active", false));
 }
}
