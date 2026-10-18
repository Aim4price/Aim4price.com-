package com.aim4price.tracker;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.*;
import java.util.*;
public class TrackerStore extends SQLiteOpenHelper {
 public TrackerStore(Context c){super(c,"tracking.db",null,1);}
 public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE queue (id TEXT PRIMARY KEY, captured INTEGER NOT NULL, payload TEXT NOT NULL)");}
 public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){}
 public synchronized boolean add(JSONObject point)throws JSONException{
  SQLiteDatabase db=getWritableDatabase();try(Cursor c=db.rawQuery("SELECT count(*) FROM queue",null)){c.moveToFirst();if(c.getLong(0)>=43200)return false;}
  ContentValues v=new ContentValues();v.put("id",point.getString("id"));v.put("captured",System.currentTimeMillis());v.put("payload",point.toString());db.insertOrThrow("queue",null,v);return true;
 }
 public synchronized JSONArray batch()throws JSONException{
  JSONArray result=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT payload FROM queue ORDER BY captured LIMIT 120",null)){while(c.moveToNext())result.put(new JSONObject(c.getString(0)));}return result;
 }
 public synchronized void acknowledge(JSONArray ids)throws JSONException{SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{for(int i=0;i<ids.length();i++)db.delete("queue","id=?",new String[]{ids.getString(i)});db.setTransactionSuccessful();}finally{db.endTransaction();}}
 public synchronized void clear(){getWritableDatabase().delete("queue",null,null);}
}
