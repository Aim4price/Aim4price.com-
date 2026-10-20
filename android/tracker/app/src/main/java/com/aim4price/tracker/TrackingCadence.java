package com.aim4price.tracker;
/** Sampling decisions are separate from network uploads and Android lifecycle. */
public final class TrackingCadence {
 public static final long MOVING_INTERVAL_MS=10000, STATIONARY_INTERVAL_MS=20000, UPLOAD_INTERVAL_SECONDS=60;
 private long stationarySince=-1,lastSaved=-1,lastFix=-1;
 private boolean stopped=false;
 public boolean isFresh(long time){return lastFix<0||time-lastFix>=9000;}
 public boolean accept(long time,boolean moved){
  if(!isFresh(time))return false;
  if(lastFix>=0&&time-lastFix>120000)stationarySince=time;
  lastFix=time;
  if(stationarySince<0||moved)stationarySince=time;
  boolean nextStopped=time-stationarySince>=15*60000;
  boolean record=lastSaved<0||!nextStopped||!stopped||time-lastSaved>=5*60000;
  stopped=nextStopped;
  if(record)lastSaved=time;
  return record;
 }
 public long interval(){return stopped?STATIONARY_INTERVAL_MS:MOVING_INTERVAL_MS;}
 public boolean stopped(){return stopped;}
}
