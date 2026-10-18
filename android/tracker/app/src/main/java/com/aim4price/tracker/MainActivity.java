package com.aim4price.tracker;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.util.UUID;
import java.util.concurrent.Executors;
public class MainActivity extends Activity {
 TextView status;final Handler handler=new Handler(Looper.getMainLooper());
 final Runnable refresh=new Runnable(){public void run(){if(status!=null){var p=TrackerApi.prefs(MainActivity.this);status.setText((p.getBoolean("active",false)?"Tracking activated":"Tracking deactivated")+"\n"+p.getString("sync","No upload yet")+"\n"+p.getString("issue",""));}handler.postDelayed(this,3000);}};
 public void onCreate(Bundle b){super.onCreate(b);draw();}
 public void onResume(){super.onResume();draw();handler.post(refresh);}
 public void onPause(){handler.removeCallbacks(refresh);super.onPause();}
 void draw(){
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(28,64,28,32);box.setBackgroundColor(Color.rgb(245,249,246));setContentView(box);
  TextView title=new TextView(this);title.setText("Aim4price Tracker");title.setTextSize(27);title.setTextColor(Color.rgb(15,88,64));box.addView(title);
  var p=TrackerApi.prefs(this);TextView asset=new TextView(this);asset.setText(p.getString("title","Connect this phone to your equipment"));asset.setTextSize(19);asset.setPadding(0,24,0,24);box.addView(asset);
  status=new TextView(this);status.setTextSize(15);box.addView(status);
  if(p.getString("token","").isEmpty()){
   EditText code=new EditText(this);code.setHint("Pairing code");code.setSingleLine(true);box.addView(code);
   TextView help=new TextView(this);help.setText("Get a code from the asset’s Advanced settings → Tracking device. While activated, this phone shares its location with that asset’s owner, including with the screen locked.");help.setPadding(0,20,0,20);box.addView(help);
   Button pair=new Button(this);pair.setText("Connect");box.addView(pair);pair.setOnClickListener(v->{pair.setEnabled(false);String value=code.getText().toString().trim();var executor=Executors.newSingleThreadExecutor();executor.execute(()->{try{JSONObject r=TrackerApi.post("/api/tracking/pair",new JSONObject().put("code",value).put("name",Build.MANUFACTURER+" "+Build.MODEL),null);new TrackerStore(this).clear();p.edit().putString("token",r.getString("token")).putString("title",r.getString("assetTitle")).putBoolean("active",false).remove("issue").apply();runOnUiThread(this::draw);}catch(Exception e){runOnUiThread(()->{status.setText(e.getMessage());pair.setEnabled(true);});}finally{executor.shutdown();}});});
  }else{
   Button activate=new Button(this);activate.setText("Activate");box.addView(activate);activate.setOnClickListener(v->activate());
   Button stop=new Button(this);stop.setText("Deactivate");box.addView(stop);stop.setOnClickListener(v->{p.edit().putBoolean("active",false).apply();stopService(new Intent(this,TrackingService.class));var executor=Executors.newSingleThreadExecutor();executor.execute(()->{try{TrackerApi.flush(this,new TrackerStore(this));}catch(Exception e){p.edit().putString("issue",e.getMessage()).apply();}finally{executor.shutdown();}});});
   TextView note=new TextView(this);note.setPadding(0,24,0,0);note.setText("Keep this phone on the equipment. Allow unrestricted battery use in Android settings. After restarting the phone, open this app and tap Activate.");box.addView(note);
  }
 }
 void activate(){
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},1);return;}
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},2);return;}
  android.location.LocationManager lm=(android.location.LocationManager)getSystemService(LOCATION_SERVICE);if(!lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)){startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));return;}
  var p=TrackerApi.prefs(this);if(!p.getBoolean("active",false))p.edit().putString("session",UUID.randomUUID().toString()).apply();p.edit().putBoolean("active",true).putString("issue","").apply();startForegroundService(new Intent(this,TrackingService.class));
 }
 public void onRequestPermissionsResult(int code,String[] permissions,int[] grants){super.onRequestPermissionsResult(code,permissions,grants);if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)activate();else status.setText("Location and notification permissions are needed. Enable them in Android app settings, then Activate.");}
}
