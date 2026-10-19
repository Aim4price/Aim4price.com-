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
 static final int GREEN=0xff254733, INK=0xff12352d, MUTED=0xff64746a, SOFT=0xffeef5f0;
 TextView status,gpsStatus,syncStatus,queueStatus,issueStatus;Button trackingButton;final Handler handler=new Handler(Looper.getMainLooper());
 final Runnable refresh=new Runnable(){public void run(){
  if(status!=null){var p=TrackerApi.prefs(MainActivity.this);boolean paired=!p.getString("token","").isEmpty();
   if(pairedScreen!=paired){draw();return;}
   boolean active=p.getBoolean("active",false);
   status.setText(paired?(active?"Tracking active":"Tracking paused"):(connectionError.isEmpty()?"Ready to connect":connectionError));
   if(paired&&gpsStatus!=null){
    gpsStatus.setText(p.getString("gps","Waiting for first GPS location"));
    syncStatus.setText(p.getString("sync","Waiting for first upload"));
    int pending=p.getInt("pending",0);queueStatus.setText(pending==0?(p.getLong("lastUploadAt",0)==0?"Waiting for first upload":"All saved readings uploaded"):pending+" readings saved on this phone");
    String issue=p.getString("gpsIssue","");String upload=p.getString("issue","");if(!upload.isEmpty())issue+=(issue.isEmpty()?"":"\n")+upload;
    issueStatus.setText(issue);issueStatus.setVisibility(issue.isEmpty()?View.GONE:View.VISIBLE);
    trackingButton.setText(active?"Deactivate tracking":"Activate tracking");
   }
  }handler.postDelayed(this,3000);
 }};
 public void onCreate(Bundle b){super.onCreate(b);readPairingIntent(getIntent());draw();}
 public void onResume(){super.onResume();if(TrackerApi.prefs(this).getBoolean("active",false)&&checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED){try{startForegroundService(new Intent(this,TrackingService.class));}catch(RuntimeException e){TrackerApi.prefs(this).edit().putString("issue","Tap Activate to resume tracking.").apply();}}handler.removeCallbacks(refresh);handler.post(refresh);}
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
 TextView text(String value,int size,int color){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setTypeface(getResources().getFont(R.font.montserrat));t.setPadding(0,dp(8),0,dp(8));return t;}
 void styleButton(Button b,boolean primary){b.setTypeface(getResources().getFont(R.font.montserrat),android.graphics.Typeface.BOLD);b.setAllCaps(false);b.setTextSize(17);b.setTextColor(primary?Color.WHITE:GREEN);b.setBackground(surface(primary?GREEN:SOFT,14));var lp=new LinearLayout.LayoutParams(-1,dp(56));lp.setMargins(0,dp(12),0,0);b.setLayoutParams(lp);}
 void draw(){
  ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setVerticalScrollBarEnabled(false);scroll.setBackgroundColor(SOFT);
  LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(20),dp(24),dp(20),dp(28));scroll.addView(page);setContentView(scroll);
  getWindow().setStatusBarColor(SOFT);getWindow().setNavigationBarColor(SOFT);getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
  if(Build.VERSION.SDK_INT>=35)page.setOnApplyWindowInsetsListener((v,insets)->{android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars());v.setPadding(dp(20)+bars.left,dp(24)+bars.top,dp(20)+bars.right,dp(28)+bars.bottom);return insets;});
  LinearLayout brand=new LinearLayout(this);brand.setGravity(Gravity.CENTER_VERTICAL);brand.setPadding(0,0,0,dp(24));
  ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.aim4price_logo);logo.setContentDescription("Aim4price logo");logo.setScaleType(ImageView.ScaleType.FIT_CENTER);brand.addView(logo,new LinearLayout.LayoutParams(dp(62),dp(62)));
  LinearLayout wordmark=new LinearLayout(this);wordmark.setOrientation(LinearLayout.VERTICAL);wordmark.setPadding(dp(14),0,0,0);
  TextView name=text("Aim4price",25,INK);name.setTypeface(name.getTypeface(),android.graphics.Typeface.BOLD);name.setPadding(0,0,0,0);wordmark.addView(name);TextView caption=text("Equipment tracker",13,MUTED);caption.setPadding(0,dp(4),0,0);wordmark.addView(caption);brand.addView(wordmark);page.addView(brand);
  var p=TrackerApi.prefs(this);pairedScreen=!p.getString("token","").isEmpty();
  LinearLayout hero=new LinearLayout(this);hero.setOrientation(LinearLayout.VERTICAL);hero.setPadding(dp(20),dp(18),dp(20),dp(18));hero.setBackground(surface(GREEN,22));
  hero.addView(text(pairedScreen?"CONNECTED ASSET":"PHONE SETUP",11,0xffd9e9df));
  TextView title=text(pairedScreen?p.getString("title","Your equipment"):"Connect your phone",24,Color.WHITE);title.setTypeface(title.getTypeface(),android.graphics.Typeface.BOLD);hero.addView(title);
  if(!pairedScreen)hero.addView(text("Keep this phone on the equipment.",14,0xffe0eee5));page.addView(hero);
  LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(dp(20),dp(20),dp(20),dp(20));var card=surface(Color.WHITE,22);card.setStroke(dp(1),0xffd7e4dc);box.setBackground(card);LinearLayout.LayoutParams cardParams=new LinearLayout.LayoutParams(-1,-2);cardParams.setMargins(0,dp(20),0,0);page.addView(box,cardParams);
  status=text("",15,INK);status.setPadding(dp(14),dp(14),dp(14),dp(14));status.setBackground(surface(SOFT,12));box.addView(status);
  if(p.getString("token","").isEmpty()){
   EditText code=new EditText(this);code.setHint("XXXX-XXXX-XXXX-XXXX");code.setTypeface(android.graphics.Typeface.MONOSPACE);code.setTextSize(19);code.setPadding(dp(16),dp(14),dp(16),dp(14));var input=surface(SOFT,12);input.setStroke(dp(1),0xffb9d1c2);code.setBackground(input);code.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);TextView label=text("Pairing code",15,INK);label.setPadding(0,dp(24),0,dp(10));box.addView(label);code.setSingleLine(true);code.setText(scannedCode);box.addView(code);
   TextView help=text("Scan the QR code on Aim4price, or enter your pairing code above.",13,MUTED);help.setPadding(0,dp(12),0,dp(8));box.addView(help);
   Button pair=new Button(this);pair.setText("Connect phone");box.addView(pair);styleButton(pair,true);pair.setOnClickListener(v->{String value=code.getText().toString().trim().replace("-","").toUpperCase(java.util.Locale.ROOT);if(!value.matches("[A-F0-9]{16}")){connectionError="Enter the full pairing code shown on Aim4price.";status.setText(connectionError);return;}pair.setEnabled(false);pair.setText("Connecting…");connectionError="Connecting…";var executor=Executors.newSingleThreadExecutor();executor.execute(()->{try{JSONObject r=TrackerApi.post("/api/tracking/pair",new JSONObject().put("code",value).put("name",Build.MANUFACTURER+" "+Build.MODEL),null);new TrackerStore(this).clear();p.edit().putString("token",r.getString("token")).putString("title",r.getString("assetTitle")).putBoolean("active",false).remove("issue").apply();runOnUiThread(()->{scannedCode="";connectionError="";draw();});}catch(Exception e){runOnUiThread(()->{connectionError=e.getMessage();status.setText(connectionError);pair.setText("Try again");pair.setEnabled(true);});}finally{executor.shutdown();}});});
  }else{
   gpsStatus=text("",14,MUTED);syncStatus=text("",14,MUTED);queueStatus=text("",14,MUTED);issueStatus=text("",14,0xff9b4d2d);
   box.addView(gpsStatus);box.addView(syncStatus);box.addView(queueStatus);box.addView(issueStatus);
   trackingButton=new Button(this);box.addView(trackingButton);styleButton(trackingButton,true);
   trackingButton.setOnClickListener(v->{if(!p.getBoolean("active",false)){activate();return;}
    p.edit().putBoolean("active",false).apply();stopService(new Intent(this,TrackingService.class));
    var executor=Executors.newSingleThreadExecutor();executor.execute(()->{try{TrackerApi.flush(this,new TrackerStore(this));}catch(Exception e){p.edit().putString("issue",e.getMessage()).apply();}finally{executor.shutdown();}});
   });
   Button settings=new Button(this);settings.setText("Battery & permissions");box.addView(settings);styleButton(settings,false);settings.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,android.net.Uri.parse("package:"+getPackageName()))));
   box.addView(text("Records every 10 seconds while moving. Uploads in batches every minute.",13,MUTED));
   TextView note=text("Keep this phone on the equipment. In Phone settings, allow unrestricted battery use. After restarting, open Tracker and tap Activate.",13,MUTED);note.setPadding(0,dp(20),0,0);box.addView(note);
  }
  TextView version=text("Aim4price Tracker · 0.6",12,MUTED);version.setGravity(Gravity.CENTER);version.setPadding(0,dp(24),0,dp(4));page.addView(version);
  page.addView(text("While activated, this phone shares its location with the asset owner, even with the screen locked.",13,Color.rgb(85,109,96)));
  handler.removeCallbacks(refresh);refresh.run();
 }
 void activate(){
  if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},1);return;}
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},2);return;}
  android.location.LocationManager lm=(android.location.LocationManager)getSystemService(LOCATION_SERVICE);if(!lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)){startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));return;}
  var p=TrackerApi.prefs(this);if(!p.getBoolean("active",false))p.edit().putString("session",UUID.randomUUID().toString()).apply();p.edit().putBoolean("active",true).putString("issue","").apply();try{startForegroundService(new Intent(this,TrackingService.class));}catch(RuntimeException e){p.edit().putBoolean("active",false).putString("issue","Could not start. Check phone permissions and tap Activate again.").apply();}
 }
 public void onRequestPermissionsResult(int code,String[] permissions,int[] grants){super.onRequestPermissionsResult(code,permissions,grants);if(grants.length>0&&grants[0]==PackageManager.PERMISSION_GRANTED)activate();else status.setText("Location and notification permissions are needed. Enable them in Android app settings, then Activate.");}
}
