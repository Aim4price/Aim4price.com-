package com.aim4price.tracker;
import android.content.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.json.*;
public class TrackerApi {
 static final String ORIGIN="https://aim4price.com";
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("tracker",Context.MODE_PRIVATE);}
 static JSONObject post(String path,JSONObject body,String token)throws Exception{
  HttpURLConnection c=(HttpURLConnection)new URL(ORIGIN+path).openConnection();
  try{c.setInstanceFollowRedirects(false);c.setRequestMethod("POST");c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");if(token!=null)c.setRequestProperty("Authorization","Bearer "+token);
   byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);c.setFixedLengthStreamingMode(bytes.length);try(OutputStream out=c.getOutputStream()){out.write(bytes);}
   int status=c.getResponseCode();InputStream input=status>=200&&status<300?c.getInputStream():c.getErrorStream();String text="";
   if(input!=null)try(input){ByteArrayOutputStream buffer=new ByteArrayOutputStream();byte[] part=new byte[4096];int count;while((count=input.read(part))!=-1){if(buffer.size()+count>65536)throw new IOException("Response too large");buffer.write(part,0,count);}text=buffer.toString("UTF-8");}
   if(status==401)throw new SecurityException("Device disconnected. Pair again.");
   if(status<200||status>=300)throw new IOException(status==400?"Check the pairing code or phone date/time.":"Connection unavailable. Readings remain on this phone.");
   return new JSONObject(text);
  }finally{c.disconnect();}
 }
 static void flush(Context context,TrackerStore store)throws Exception{
  var prefs=prefs(context);String token=prefs.getString("token","");if(token.isEmpty())return;
  // Bounded catch-up work. Repeat on the next upload tick until the durable queue is empty.
  for(int n=0;n<8;n++){
   JSONArray points=store.batch();JSONObject body=new JSONObject().put("points",points).put("active",prefs.getBoolean("active",false)).put("stateAt",Instant.now().toString());
   JSONObject result=post("/api/tracking/points",body,token);store.acknowledge(result.getJSONArray("accepted"));prefs.edit().putString("sync","Last upload: "+java.time.LocalTime.now().withNano(0)).apply();
   if(points.length()<120)break;
  }
 }
}
