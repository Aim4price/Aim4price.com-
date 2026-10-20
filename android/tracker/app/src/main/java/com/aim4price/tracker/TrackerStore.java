package com.aim4price.tracker;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

/** Device-private durable outbox. A new pairing never relabels or deletes old readings. */
public class TrackerStore extends SQLiteOpenHelper {
 private final Context context;
 public TrackerStore(Context c){super(c,"tracking.db",null,2);context=c.getApplicationContext();}
 public void onCreate(SQLiteDatabase db){
  db.execSQL("CREATE TABLE queue (id TEXT PRIMARY KEY,captured INTEGER NOT NULL,payload TEXT NOT NULL,stream TEXT NOT NULL DEFAULT '',reason TEXT)");
  createStreams(db);
 }
 private void createStreams(SQLiteDatabase db){db.execSQL("CREATE TABLE IF NOT EXISTS streams (id TEXT PRIMARY KEY,token TEXT NOT NULL,asset TEXT NOT NULL DEFAULT '',title TEXT NOT NULL DEFAULT '',blocked INTEGER NOT NULL DEFAULT 0)");db.execSQL("CREATE INDEX IF NOT EXISTS queue_stream ON queue(stream,reason,captured)");}
 public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){
  if(oldVersion<2){
   db.execSQL("ALTER TABLE queue ADD COLUMN stream TEXT NOT NULL DEFAULT ''");db.execSQL("ALTER TABLE queue ADD COLUMN reason TEXT");createStreams(db);
   var p=TrackerApi.prefs(context);String token=p.getString("token","");
   if(!token.isEmpty()){String key=remember(db,token,p.getString("assetId",""),p.getString("title","Previous asset"));db.execSQL("UPDATE queue SET stream=? WHERE stream=''",new Object[]{key});}
   // Without an old credential the legacy readings remain available for export, never assigned to a new asset.
  }
 }
 static String key(String token){try{byte[] h=MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();for(byte b:h)s.append(String.format("%02x",b));return s.toString();}catch(Exception e){throw new IllegalStateException(e);}}
 private String remember(SQLiteDatabase db,String token,String asset,String title){String id=key(token);ContentValues v=new ContentValues();v.put("id",id);v.put("token",token);v.put("asset",asset);v.put("title",title);db.insertWithOnConflict("streams",null,v,SQLiteDatabase.CONFLICT_IGNORE);return id;}
 public synchronized void rememberConnection(String token,String asset,String title){remember(getWritableDatabase(),token,asset,title);}
 public synchronized void retryConnections(){getWritableDatabase().execSQL("UPDATE streams SET blocked=0");}
 public synchronized boolean add(JSONObject point,String token)throws JSONException{
  SQLiteDatabase db=getWritableDatabase();if(count(db,"SELECT count(*) FROM queue",null)>=259200)return false;
  String stream=remember(db,token,"","Previous connection");
  ContentValues v=new ContentValues();v.put("id",point.getString("id"));v.put("captured",System.currentTimeMillis());v.put("payload",point.toString());v.put("stream",stream);db.insertOrThrow("queue",null,v);return true;
 }
 public synchronized JSONArray batch(String token)throws JSONException{
  JSONArray result=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT payload FROM queue WHERE stream=? AND reason IS NULL ORDER BY captured,id LIMIT 120",new String[]{key(token)})){while(c.moveToNext())result.put(new JSONObject(c.getString(0)));}return result;
 }
 public synchronized String recoveryToken(String current,String asset){
  try(Cursor c=getReadableDatabase().rawQuery("SELECT s.token FROM streams s WHERE s.id<>? AND s.blocked=0 AND (s.asset=? OR s.asset='') AND EXISTS(SELECT 1 FROM queue q WHERE q.stream=s.id AND q.reason IS NULL) ORDER BY s.id LIMIT 1",new String[]{key(current),asset})){return c.moveToFirst()?c.getString(0):null;}
 }
 public synchronized void blockRecovery(String token){getWritableDatabase().execSQL("UPDATE streams SET blocked=1 WHERE id=?",new Object[]{key(token)});}
 public synchronized void acknowledge(String token,JSONArray ids,JSONArray rejected)throws JSONException{
  SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{
   for(int i=0;i<ids.length();i++)db.delete("queue","id=? AND stream=?",new String[]{ids.getString(i),key(token)});
   for(int i=0;i<rejected.length();i++){JSONObject r=rejected.getJSONObject(i);ContentValues v=new ContentValues();v.put("reason",r.getString("reason"));db.update("queue",v,"id=? AND stream=?",new String[]{r.getString("id"),key(token)});}
   db.setTransactionSuccessful();
  }finally{db.endTransaction();}
 }
 private int count(SQLiteDatabase db,String sql,String[] args){try(Cursor c=db.rawQuery(sql,args)){c.moveToFirst();return c.getInt(0);}}
 public synchronized int pending(){return count(getReadableDatabase(),"SELECT count(*) FROM queue",null);}
 public synchronized int uploadable(String token){return count(getReadableDatabase(),"SELECT count(*) FROM queue WHERE stream=? AND reason IS NULL",new String[]{key(token)});}
 public synchronized int retained(String token){return pending()-uploadable(token);}
 /** Backup deliberately contains no upload credentials. */
 public synchronized void export(java.io.OutputStream output)throws Exception{
  java.io.Writer writer=new java.io.OutputStreamWriter(output,StandardCharsets.UTF_8);writer.write("{\"format\":\"aim4price-tracker-backup-v1\",\"readings\":[");boolean first=true;
  try(Cursor c=getReadableDatabase().rawQuery("SELECT q.payload,q.reason,s.asset,s.title,q.stream FROM queue q LEFT JOIN streams s ON s.id=q.stream ORDER BY q.captured,q.id",null)){
   while(c.moveToNext()){if(!first)writer.write(",");first=false;JSONObject entry=new JSONObject().put("reading",new JSONObject(c.getString(0))).put("reason",c.isNull(1)?"Awaiting recovery":c.getString(1)).put("assetId",c.isNull(2)?"":c.getString(2)).put("assetTitle",c.isNull(3)?"Unknown previous connection":c.getString(3)).put("connectionId",c.getString(4));writer.write(entry.toString());}
  }writer.write("]}");writer.flush();
 }
}
