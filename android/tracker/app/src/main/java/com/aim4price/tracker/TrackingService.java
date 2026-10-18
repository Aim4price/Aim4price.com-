package com.aim4price.tracker;
import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;
import org.json.*;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.*;
public class TrackingService extends Service implements LocationListener {
 LocationManager manager;TrackerStore store;Location anchor;long stationarySince=0,lastSaved=0,lastAttempt=0,lastFix=0;boolean started=false,wasStopped=false;
 final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();
 public static void channel(Context c){((NotificationManager)c.getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("tracking","Equipment tracking",NotificationManager.IMPORTANCE_LOW));}
 public static Notification notification(Context c,String text){channel(c);return new Notification.Builder(c,"tracking").setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("Aim4price Tracker").setContentText(text).setOngoing(true).setContentIntent(PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT)).build();}
 public int onStartCommand(Intent intent,int flags,int startId){
  if(!TrackerApi.prefs(this).getBoolean("active",false)){stopSelf();return START_NOT_STICKY;}
  startForeground(1,notification(this,"Recording equipment location"));if(started)return START_STICKY;started=true;store=new TrackerStore(this);manager=(LocationManager)getSystemService(LOCATION_SERVICE);
  try{manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,60000,0,this,Looper.getMainLooper());}catch(SecurityException e){TrackerApi.prefs(this).edit().putBoolean("active",false).putString("issue","Enable precise location, then Activate.").apply();stopSelf();return START_NOT_STICKY;}
  worker.scheduleWithFixedDelay(this::upload,0,5,TimeUnit.MINUTES);return START_STICKY;
 }
 public void onLocationChanged(Location location){
  long now=System.currentTimeMillis();if(!TrackerApi.prefs(this).getBoolean("active",false))return;
  if(!location.hasAccuracy()||location.getAccuracy()>50||now-location.getTime()>120000||location.getTime()>now+120000)return;
  if(location.getTime()-lastFix<55000)return;lastFix=location.getTime();
  if(anchor==null){anchor=new Location(location);stationarySince=location.getTime();}
  float threshold=Math.max(10,Math.max(anchor.getAccuracy(),location.getAccuracy()));
  if(anchor.distanceTo(location)>threshold){anchor=new Location(location);stationarySince=location.getTime();}
  boolean stopped=location.getTime()-stationarySince>=15*60000;
  if(stopped&&wasStopped&&location.getTime()-lastSaved<10*60000)return;
  wasStopped=stopped;
  lastSaved=location.getTime();var p=TrackerApi.prefs(this);String session=p.getString("session","");if(session.isEmpty()){session=UUID.randomUUID().toString();p.edit().putString("session",session).apply();}
  final String sid=session;worker.execute(()->{try{
   JSONObject point=new JSONObject().put("id",UUID.randomUUID().toString()).put("sessionId",sid).put("capturedAt",Instant.ofEpochMilli(location.getTime()).toString()).put("latitude",location.getLatitude()).put("longitude",location.getLongitude()).put("accuracy",location.getAccuracy()).put("motion",stopped?"stationary":"moving");
   if(!store.add(point)){p.edit().putBoolean("active",false).putString("issue","Offline queue full. Connect to upload readings before activating again.").apply();stopSelf();return;}
   if(System.currentTimeMillis()-lastAttempt>=120000)upload();
  }catch(Exception e){p.edit().putString("issue","Could not save reading. Open the app to check storage.").apply();}});
 }
 void upload(){lastAttempt=System.currentTimeMillis();try{TrackerApi.flush(this,store);TrackerApi.prefs(this).edit().putString("issue","").apply();}catch(SecurityException e){TrackerApi.prefs(this).edit().putBoolean("active",false).remove("token").putString("issue",e.getMessage()).apply();stopSelf();}catch(Exception e){TrackerApi.prefs(this).edit().putString("issue",e.getMessage()).apply();}}
 public void onProviderDisabled(String provider){TrackerApi.prefs(this).edit().putString("issue","GPS is switched off.").apply();}
 public void onProviderEnabled(String provider){}
 public void onStatusChanged(String provider,int status,Bundle extras){}
 public IBinder onBind(Intent intent){return null;}
 public void onDestroy(){if(manager!=null)manager.removeUpdates(this);worker.shutdown();super.onDestroy();}
}
