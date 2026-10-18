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
 String scannedCode="", connectionError=""; boolean pairedScreen=false;
 TextView status;final Handler handler=new Handler(Looper.getMainLooper());
 final Runnable refresh=new Runnable(){public void run(){if(status!=null){var p=TrackerApi.prefs(MainActivity.this);if(pairedScreen!=!p.getString("token","").isEmpty()){draw();return;}status.setText((p.getString("token","").isEmpty() ? (connectionError.isEmpty()?"Ready to connect":connectionError) : (p.getBoolean("active",false)?"Tracking activated":"Tracking deactivated")+"\n"+p.getString("sync","No upload yet")+"\n"+p.getString("issue","")));}handler.postDelayed(this,3000);}};
 public void onCreate(Bundle b){super.onCreate(b);readPairingIntent(getIntent());draw();}
 public void onResume(){super.onResume();handler.removeCallbacks(refresh);handler.post(refresh);}
 public void onPause(){handler.removeCallbacks(refresh);super.onPause();}
 public void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);readPairingIntent(intent);draw();}
 void readPairingIntent(Intent intent){
  android.net.Uri uri=intent.getData();
  if(uri==null||!"aim4price-tracker".equals(uri.getScheme())||!"pair".equals(uri.getHost()))return;
  String value=uri.getQueryParameter("code");
  if(value!=null&&value.matches("[A-Fa-f0-9]{16}"))scannedCode=value.toUpperCase(java.util.Locale.ROOT);
  intent.setData(null);
 }
 int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
 android.graphics.drawable.GradientDrawable surface(int color,int radius){var d=new android.graphics.drawable.GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
 TextView text(String value,int size,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setPadding(0,dp(8),0,dp(8));return t;}
 void styleButton(Button b,boolean primary){b.setAllCaps(false);b.setTextSize(17);b.setTextColor(primary?Color.WHITE:Color.rgb(23,96,68));b.setBackground(surface(primary?Color.rgb(23,96,68):Color.rgb(231,242,235),14));var lp=new LinearLayout.LayoutParams(-1,dp(56));lp.setMargins(0,dp(12),0,0);b.setLayoutParams(lp);}
 void draw(){
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(Color.rgb(242,247,244));LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(dp(24),dp(36),dp(24),dp(28));scroll.addView(box);setContentView(scroll);
  getWindow().setStatusBarColor(Color.rgb(242,247,244));getWindow().setNavigationBarColor(Color.rgb(242,247,244));getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
  box.addView(text("AIM4PRICE  /  EQUIPMENT TRACKING",12,Color.rgb(63,105,83)));
  TextView title=new TextView(this);title.setText("Aim4price Tracker");title.setTextSize(30);title.setTypeface(null,android.graphics.Typeface.BOLD);title.setTextColor(Color.rgb(15,88,64));box.addView(title);
  var p=TrackerApi.prefs(this);pairedScreen=!p.getString("token","").isEmpty();TextView asset=new TextView(this);asset.setText(p.getString("title","Connect this phone to your equipment"));asset.setTextSize(19);asset.setPadding(0,dp(16),0,dp(20));box.addView(asset);
  status=new TextView(this);status.setTextSize(16);status.setTextColor(Color.rgb(35,79,57));status.setPadding(dp(16),dp(16),dp(16),dp(16));status.setBackground(surface(Color.rgb(227,239,231),14));box.addView(status);
  if(p.getString("token","").isEmpty()){
   EditText code=new EditText(this);code.setHint("XXXX-XXXX-XXXX-XXXX");code.setTextSize(19);code.setPadding(dp(16),dp(14),dp(16),dp(14));code.setBackground(surface(Color.WHITE,12));code.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);box.addView(text("Pairing code",16,Color.rgb(24,62,48)));code.setSingleLine(true);code.setText(scannedCode);box.addView(code);
   TextView help=new TextView(this);help.setText("On Aim4price, open the asset’s Tracking device and create a code. Scan its QR with this phone’s camera, or enter the code above.");help.setTextSize(15);help.setTextColor(Color.rgb(85,109,96));help.setPadding(0,dp(16),0,dp(12));box.addView(help);
   Button pair=new Button(this);pair.setText("Connect phone");box.addView(pair);styleButton(pair,true);pair.setOnClickListener(v->{String value=code.getText().toString().trim().replace("-","").toUpperCase(java.util.Locale.ROOT);if(!value.matches("[A-F0-9]{16}")){connectionError="Enter the full pairing code shown on Aim4price.";status.setText(connectionError);return;}pair.setEnabled(false);pair.setText("Connecting…");connectionError="Connecting…";var executor=Executors.newSingleThreadExecutor();executor.execute(()->{try{JSONObject r=TrackerApi.post("/api/tracking/pair",new JSONObject().put("code",value).put("name",Build.MANUFACTURER+" "+Build.MODEL),null);new TrackerStore(this).clear();p.edit().putString("token",r.getString("token")).putString("title",r.getString("assetTitle")).putBoolean("active",false).remove("issue").apply();runOnUiThread(()->{scannedCode="";connectionError="";draw();});}catch(Exception e){runOnUiThread(()->{connectionError=e.getMessage();status.setText(connectionError);pair.setText("Try again");pair.setEnabled(true);});}finally{executor.shutdown();}});});
  }else{
   Button activate=new Button(this);activate.setText("Activate tracking");box.addView(activate);styleButton(activate,true);activate.setOnClickListener(v->activate());
   Button stop=new Button(this);stop.setText("Deactivate tracking");box.addView(stop);styleButton(stop,false);stop.setOnClickListener(v->{p.edit().putBoolean("active",false).apply();stopService(new Intent(this,TrackingService.class));var executor=Executors.newSingleThreadExecutor();executor.execute(()->{try{TrackerApi.flush(this,new TrackerStore(this));}catch(Exception e){p.edit().putString("issue",e.getMessage()).apply();}finally{executor.shutdown();}});});
   TextView note=new TextView(this);note.setTextSize(15);note.setTextColor(Color.rgb(85,109,96));note.setPadding(0,dp(24),0,0);note.setText("Keep this phone on the equipment. Allow unrestricted battery use in Android settings. After restarting the phone, open this app and tap Activate.");box.addView(note);
  }
  box.addView(text("Aim4price Tracker 0.3 • Android",13,Color.rgb(85,109,96)));
  box.addView(text("While activated, this phone shares its location with the asset owner, even with the screen locked.",13,Color.rgb(85,109,96)));
  handler.removeCallbacks(refresh);refresh.run();
 }
 void activate(){
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},1);return;}
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},2);return;}
  android.location.LocationManager lm=(android.location.LocationManager)getSystemService(LOCATION_SERVICE);if(!lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)){startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));return;}
  var p=TrackerApi.prefs(this);if(!p.getBoolean("active",false))p.edit().putString("session",UUID.randomUUID().toString()).apply();p.edit().putBoolean("active",true).putString("issue","").apply();startForegroundService(new Intent(this,TrackingService.class));
 }
 public void onRequestPermissionsResult(int code,String[] permissions,int[] grants){super.onRequestPermissionsResult(code,permissions,grants);if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)activate();else status.setText("Location and notification permissions are needed. Enable them in Android app settings, then Activate.");}
}
