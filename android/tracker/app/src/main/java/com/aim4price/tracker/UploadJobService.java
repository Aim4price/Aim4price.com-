package com.aim4price.tracker;
import android.app.job.*;
import android.content.*;
import java.util.concurrent.*;
/** Retry pending uploads even when recording is paused. No location is collected by this job. */
public class UploadJobService extends JobService {
 private ExecutorService executor;
 static void schedule(Context c){((JobScheduler)c.getSystemService(JOB_SCHEDULER_SERVICE)).schedule(new JobInfo.Builder(7,new ComponentName(c,UploadJobService.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setMinimumLatency(60000).setPersisted(true).build());}
 public boolean onStartJob(JobParameters params){executor=Executors.newSingleThreadExecutor();executor.execute(()->{
  boolean retry=false;
  try(TrackerStore store=new TrackerStore(this)){
   TrackerApi.flush(this,store);String token=TrackerApi.prefs(this).getString("token","");retry=!token.isEmpty()&&store.uploadable(token)>0;
  }catch(SecurityException e){TrackerApi.prefs(this).edit().putBoolean("active",false).remove("token").putString("issue",e.getMessage()).apply();}
  catch(Exception e){retry=true;TrackerApi.prefs(this).edit().putString("issue","Upload pending. Readings are saved on this phone.").apply();}
  jobFinished(params,retry);executor.shutdown();
 });return true;}
 public boolean onStopJob(JobParameters params){if(executor!=null)executor.shutdownNow();return true;}
}
