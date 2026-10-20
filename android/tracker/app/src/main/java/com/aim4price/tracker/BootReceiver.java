package com.aim4price.tracker;
import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.app.*;
import android.os.Build;
public class BootReceiver extends BroadcastReceiver {
 public void onReceive(Context c,Intent i){
  if(!Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())&&!Intent.ACTION_MY_PACKAGE_REPLACED.equals(i.getAction()))return;
  TrackerApi.prefs(c).edit().putBoolean("serviceRunning",false).apply();
  UploadJobService.schedule(c);
  var p=TrackerApi.prefs(c);if(!p.getBoolean("active",false)||p.getString("token","").isEmpty())return;
  boolean permitted=c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED&&(Build.VERSION.SDK_INT<29||c.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)==PackageManager.PERMISSION_GRANTED);
  if(permitted){try{c.startForegroundService(new Intent(c,TrackingService.class));return;}catch(RuntimeException ignored){}}
  // Keep the user's active choice: opening the app resumes it; never claim recording has resumed here.
  p.edit().putString("issue","Open Tracker to resume. Allow location all the time for restart recovery.").apply();
  try{((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(2,TrackingService.notification(c,"Open Tracker to resume recording."));}catch(SecurityException ignored){}
 }
}
