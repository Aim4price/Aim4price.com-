package com.aim4price.tracker;
import android.content.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.json.*;
public class TrackerApi {
 static final ThreadLocal<android.content.SharedPreferences> prefsForUsage=new ThreadLocal<>();
 static final String ORIGIN="https://www.aim4price.com";
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("tracker",Context.MODE_PRIVATE);}
 static JSONObject post(String path,JSONObject body,String token)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(ORIGIN+path).openConnection();
  try{c.setInstanceFollowRedirects(false);c.setRequestMethod("POST");c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");if(token!=null)c.setRequestProperty("Authorization","Bearer "+token);
   byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}
   var usage=prefsForUsage.get();if(usage!=null)usage.edit().putLong("uploadBytes",usage.getLong("uploadBytes",0)+bytes.length).apply();
   int status=c.getResponseCode();InputStream input=status>=200&&status<300?c.getInputStream():c.getErrorStream();String text="";
   if(input!=null)try(input){ByteArrayOutputStream buffer=new ByteArrayOutputStream();byte[] part=new byte[4096];int count;while((count=input.read(part))!=-1){if(buffer.size()+count>65536)throw new IOException("Response too large");buffer.write(part,0,count);}text=buffer.toString("UTF-8");}
   if(status==403)throw new RecoveryUnavailableException();
   if(status==401)throw new SecurityException("Device disconnected. Pair again.");
   if(status<200||status>=300)throw new IOException(status==400?"Check the pairing code or phone date/time.":"Connection unavailable. Readings remain on this phone.");
   return new JSONObject(text);
  }finally{c.disconnect();}
 }
 static class RecoveryUnavailableException extends IOException {}
 static synchronized void flush(Context context,TrackerStore store)throws Exception{
  var prefs=prefs(context);String token=prefs.getString("token","");if(token.isEmpty())return;
  // Bounded catch-up work. Repeat on the next upload tick until the durable queue is empty.
  for(int n=0;n<8;n++){
   String recovery=n%2==1?store.recoveryToken(token,prefs.getString("assetId","")):null;
   if(recovery==null&&store.uploadable(token)==0)recovery=store.recoveryToken(token,prefs.getString("assetId",""));
   String source=recovery==null?token:recovery;
   JSONArray points=store.batch(source);JSONObject body=new JSONObject().put("points",points).put("partial",true).put("active",prefs.getBoolean("active",false)).put("stateAt",Instant.now().toString());
   if(recovery!=null)body.put("recoveryToken",recovery);
   JSONObject diagnostics=new JSONObject().put("pending",Math.max(0,store.uploadable(token)-(recovery==null?points.length():0))).put("retained",store.retained(token)).put("rejectedFixes",prefs.getInt("rejectedFixes",0)).put("accuracy",prefs.getFloat("accuracy",-1)).put("provider",prefs.getString("provider","unknown"));
   for(String field:new String[]{"lastCallbackAt","lastGpsAt","lastSavedAt"}){long value=prefs.getLong(field,0);if(value>0)diagnostics.put(field,Instant.ofEpochMilli(value).toString());}
   diagnostics.put("version",context.getPackageManager().getPackageInfo(context.getPackageName(),0).versionName);
   android.content.Intent battery=context.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
   if(battery!=null){int level=battery.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL,-1),scale=battery.getIntExtra(android.os.BatteryManager.EXTRA_SCALE,-1);if(level>=0&&scale>0)diagnostics.put("batteryPercent",Math.round(level*100f/scale));}
   diagnostics.put("recording",prefs.getBoolean("serviceRunning",false)?1:0);
   diagnostics.put("backgroundLocation",android.os.Build.VERSION.SDK_INT<29||context.checkSelfPermission(android.Manifest.permission.ACCESS_BACKGROUND_LOCATION)==android.content.pm.PackageManager.PERMISSION_GRANTED?1:0);
   body.put("diagnostics",diagnostics);
   JSONObject result;try{prefsForUsage.set(prefs);result=post("/api/tracking/points",body,token);}catch(RecoveryUnavailableException e){if(recovery==null)throw e;store.blockRecovery(recovery);continue;}finally{prefsForUsage.remove();}store.acknowledge(source,result.getJSONArray("accepted"),result.optJSONArray("rejected")==null?new JSONArray():result.getJSONArray("rejected"));prefs.edit().putString("sync","Last upload: "+java.time.LocalTime.now().withNano(0)).putLong("lastUploadAt",System.currentTimeMillis()).putInt("pending",store.pending()).apply();
   if(store.uploadable(token)==0&&store.recoveryToken(token,prefs.getString("assetId",""))==null)break;
  }
 }
}
