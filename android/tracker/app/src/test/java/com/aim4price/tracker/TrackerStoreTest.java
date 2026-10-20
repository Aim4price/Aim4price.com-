package com.aim4price.tracker;
import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class TrackerStoreTest {
 Context context;String old="a".repeat(64),next="b".repeat(64);
 @Before public void setup(){context=RuntimeEnvironment.getApplication();context.deleteDatabase("tracking.db");TrackerApi.prefs(context).edit().clear().commit();}
 JSONObject point(String id)throws Exception{return new JSONObject().put("id",id).put("capturedAt","2026-10-20T08:00:00Z").put("latitude",-33).put("longitude",18);}
 @Test public void upgradePreservesOldReadingsAndPairingNeverRelabelsThem()throws Exception{
  TrackerApi.prefs(context).edit().putString("token",old).putString("title","Tractor").commit();
  try(SQLiteDatabase legacy=context.openOrCreateDatabase("tracking.db",0,null)){legacy.execSQL("CREATE TABLE queue(id TEXT PRIMARY KEY,captured INTEGER NOT NULL,payload TEXT NOT NULL)");legacy.execSQL("INSERT INTO queue VALUES('old',1,?)",new Object[]{point("old").toString()});legacy.setVersion(1);}
  try(TrackerStore store=new TrackerStore(context)){
   assertEquals(1,store.batch(old).length());store.rememberConnection(next,"asset-a","Tractor");
   TrackerApi.prefs(context).edit().putString("token",next).putString("assetId","asset-a").commit();store.add(point("new"),next);
   assertEquals("old",store.batch(old).getJSONObject(0).getString("id"));assertEquals("new",store.batch(next).getJSONObject(0).getString("id"));assertEquals(old,store.recoveryToken(next,"asset-a"));
   store.acknowledge(next,new JSONArray().put("old"),new JSONArray());assertEquals(2,store.pending());
   store.acknowledge(old,new JSONArray().put("old"),new JSONArray());assertEquals(1,store.pending());
  }
 }
 @Test public void rejectedReadingsStayExportableWithoutCredentials()throws Exception{
  try(TrackerStore store=new TrackerStore(context)){
   store.rememberConnection(old,"asset-a","Tractor");store.add(point("bad"),old);store.add(point("good"),old);
   store.acknowledge(old,new JSONArray().put("good"),new JSONArray().put(new JSONObject().put("id","bad").put("reason","Reading is older than 30 days")));
   assertEquals(1,store.pending());assertEquals(0,store.batch(old).length());
   java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream();store.export(output);String backup=output.toString("UTF-8");assertTrue(backup.contains("30 days"));assertFalse(backup.contains(old));assertTrue(backup.contains("asset-a"));
  }
 }
 @Test public void anotherAssetCannotUploadThePreviousAssetsQueue()throws Exception{
  try(TrackerStore store=new TrackerStore(context)){
   store.rememberConnection(old,"asset-a","Tractor");store.add(point("old"),old);store.rememberConnection(next,"asset-b","Truck");
   assertNull(store.recoveryToken(next,"asset-b"));assertEquals(0,store.batch(next).length());assertEquals(1,store.pending());
  }
 }
 @Test public void legacyWithoutCredentialIsRetainedButNeverAssignedToNewPhone()throws Exception{
  try(SQLiteDatabase legacy=context.openOrCreateDatabase("tracking.db",0,null)){legacy.execSQL("CREATE TABLE queue(id TEXT PRIMARY KEY,captured INTEGER NOT NULL,payload TEXT NOT NULL)");legacy.execSQL("INSERT INTO queue VALUES('unknown',1,?)",new Object[]{point("unknown").toString()});legacy.setVersion(1);}
  try(TrackerStore store=new TrackerStore(context)){assertEquals(1,store.pending());store.rememberConnection(next,"asset-b","Truck");assertEquals(0,store.batch(next).length());assertNull(store.recoveryToken(next,"asset-b"));assertEquals(1,store.retained(next));}
 }
}
