package com.aim4price.tracker;
import android.content.*;
import android.app.*;
public class BootReceiver extends BroadcastReceiver {
 public void onReceive(Context c,Intent i){if(TrackerApi.prefs(c).getBoolean("active",false)){
  TrackerApi.prefs(c).edit().putBoolean("active",false).putString("issue","Phone restarted. Tap Activate to resume.").apply();
  try{((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(2,TrackingService.notification(c,"Phone restarted. Open and activate tracking."));}catch(SecurityException ignored){}
 }}
}
