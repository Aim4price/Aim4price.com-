package com.aim4price.tracker;
import org.junit.Test;
import static org.junit.Assert.*;
public class TrackingCadenceTest {
 @Test public void movingKeepsSixDistinctReadingsPerMinute(){TrackingCadence c=new TrackingCadence();for(int i=0;i<6;i++)assertTrue(c.accept(i*10000,true));assertFalse(c.accept(50001,true));assertEquals(10000,c.interval());}
 @Test public void stationarySavesEveryFiveMinutesAndMovementResumesImmediately(){TrackingCadence c=new TrackingCadence();assertTrue(c.accept(0,false));for(int i=1;i<=90;i++)assertTrue(c.accept(i*10000,false));assertTrue(c.stopped());assertEquals(60000,c.interval());assertFalse(c.accept(960000,false));assertFalse(c.accept(1020000,false));assertFalse(c.accept(1080000,false));assertFalse(c.accept(1140000,false));assertTrue(c.accept(1200000,false));assertTrue(c.accept(1260000,true));assertFalse(c.stopped());assertEquals(10000,c.interval());assertTrue(c.accept(1270000,true));}
 @Test public void missingSignalDoesNotProveAStop(){TrackingCadence c=new TrackingCadence();c.accept(0,false);c.accept(900000,false);assertFalse(c.stopped());}
 @Test public void olderCallbacksDoNotResetTheClock(){TrackingCadence c=new TrackingCadence();assertTrue(c.accept(10000,true));assertFalse(c.accept(0,true));assertTrue(c.accept(20000,true));}
}
