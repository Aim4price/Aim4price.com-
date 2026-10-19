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
 LocationManager manager;TrackerStore store;Location anchor;long lastAttempt=0;boolean started=false,hasSaved=false;
 final TrackingCadence cadence=new TrackingCadence();final Handler main=new Handler(Looper.getMainLooper());

 final ScheduledExecutorService worker=Executors.newSingleThreadScheduledExecutor();
 public static void channel(Context c){((NotificationManager)c.getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel("tracking","Equipment tracking",NotificationManager.IMPORTANCE_LOW));}
 public static Notification notification(Context c,String text){channel(c);return new Notification.Builder(c,"tracking").setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("Aim4price Tracker").setContentText(text).setOngoing(true).setContentIntent(PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT)).build();}
 public int onStartCommand(Intent intent,int flags,int startId){
  if(!TrackerApi.prefs(this).getBoolean("active",false)){stopSelf();return START_NOT_STICKY;}
  startForeground(1,notification(this,"Recording equipment location"));if(started)return START_STICKY;started=true;store=new TrackerStore(this);manager=(LocationManager)getSystemService(LOCATION_SERVICE);
  try{manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,TrackingCadence.MOVING_INTERVAL_MS,0,this,Looper.getMainLooper());}catch(SecurityException e){TrackerApi.prefs(this).edit().putBoolean("active",false).putString("issue","Enable precise location, then Activate.").apply();stopSelf();return START_NOT_STICKY;}
  worker.scheduleWithFixedDelay(this::upload,0,TrackingCadence.UPLOAD_INTERVAL_SECONDS,TimeUnit.SECONDS);return START_STICKY;
 }
 public void onLocationChanged(Location location){
  long now=System.currentTimeMillis();if(!TrackerApi.prefs(this).getBoolean("active",false))return;
  if(!location.hasAccuracy()||location.getAccuracy()>50||now-location.getTime()>120000||location.getTime()>now+120000){TrackerApi.prefs(this).edit().putString("gpsIssue","GPS reading too inaccurate or outdated. Move the phone near a window.").apply();return;}
  if(!cadence.isFresh(location.getTime()))return;
  TrackerApi.prefs(this).edit().putString("gps","Last GPS: "+java.time.LocalTime.now().withNano(0)).putLong("lastGpsAt",now).putString("gpsIssue","").apply();
  boolean moved=anchor==null||anchor.distanceTo(location)>Math.max(10,Math.max(anchor.getAccuracy(),location.getAccuracy()));
  long previousInterval=cadence.interval();
  boolean save=cadence.accept(location.getTime(),moved);
  if(moved)anchor=new Location(location);
  if(previousInterval!=cadence.interval())requestUpdates(cadence.interval());
  if(!save)return;
  boolean stopped=cadence.stopped();final boolean firstReading=!hasSaved;hasSaved=true;
  var p=TrackerApi.prefs(this);String session=p.getString("session","");if(session.isEmpty()){session=UUID.randomUUID().toString();p.edit().putString("session",session).apply();}
  final String sid=session;worker.execute(()->{try{
   JSONObject point=new JSONObject().put("id",UUID.randomUUID().toString()).put("sessionId",sid).put("capturedAt",Instant.ofEpochMilli(location.getTime()).toString()).put("latitude",location.getLatitude()).put("longitude",location.getLongitude()).put("accuracy",location.getAccuracy()).put("motion",stopped?"stationary":"moving");
   if(!store.add(point)){p.edit().putBoolean("active",false).putString("issue","Offline queue full. Connect to upload readings before activating again.").apply();stopSelf();return;}
   p.edit().putInt("pending",store.pending()).apply();
   if(firstReading||System.currentTimeMillis()-lastAttempt>=60000)upload();
  }catch(Exception e){p.edit().putString("issue","Could not save reading. Open the app to check storage.").apply();}});
 }
 void requestUpdates(long interval){try{manager.removeUpdates(this);manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,interval,0,this,Looper.getMainLooper());}catch(SecurityException e){TrackerApi.prefs(this).edit().putString("gpsIssue","Location permission was removed. Open phone settings.").apply();}}
 void upload(){
  var prefs=TrackerApi.prefs(this);long lastGps=prefs.getLong("lastGpsAt",0);
  if(System.currentTimeMillis()-lastGps>120000){prefs.edit().putString("gpsIssue","Waiting for a clear GPS signal. Keep the phone near a window.").apply();main.post(()->{if(started&&prefs.getBoolean("active",false))requestUpdates(cadence.interval());});}
  lastAttempt=System.currentTimeMillis();try{TrackerApi.flush(this,store);TrackerApi.prefs(this).edit().putString("issue","").apply();}catch(SecurityException e){TrackerApi.prefs(this).edit().putBoolean("active",false).remove("token").putString("issue",e.getMessage()).apply();stopSelf();}catch(Exception e){TrackerApi.prefs(this).edit().putString("issue",e.getMessage()).apply();}}
 public void onProviderDisabled(String provider){TrackerApi.prefs(this).edit().putString("gpsIssue","GPS is switched off.").apply();}
 public void onProviderEnabled(String provider){TrackerApi.prefs(this).edit().putString("gpsIssue","Waiting for GPS").apply();}
 public void onStatusChanged(String provider,int status,Bundle extras){}
 public IBinder onBind(Intent intent){return null;}
 public void onDestroy(){started=false;main.removeCallbacksAndMessages(null);if(manager!=null)manager.removeUpdates(this);worker.shutdown();super.onDestroy();}
}
