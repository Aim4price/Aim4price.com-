import { randomUUID } from 'node:crypto';
import { getDb } from './db';
import { tutorialCatalogue, type TutorialAudience } from './tutorial-catalogue';
import { MAX_TUTORIAL_VIDEO_BYTES, tutorialVideoType } from './tutorial-video-policy';
export type VideoSlot = { audience:string; feature:string; draft_id:string|null; published_id:string|null; revision:number; draft_name:string|null; published_name:string|null };
let ready:Promise<void>|undefined;
export function ensureTutorialVideos(){
 if(!ready)ready=(async()=>{await getDb().query(`CREATE TABLE IF NOT EXISTS tutorial_video_files (id uuid PRIMARY KEY, name text NOT NULL, content_type text NOT NULL, byte_size integer NOT NULL, data bytea NOT NULL, created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); CREATE TABLE IF NOT EXISTS tutorial_video_slots (audience text NOT NULL, feature text NOT NULL, draft_id uuid REFERENCES tutorial_video_files(id), published_id uuid REFERENCES tutorial_video_files(id), revision integer NOT NULL DEFAULT 0, updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(audience,feature))`);})().catch(e=>{ready=undefined;throw e;});
 return ready;
}
export function validVideoSlot(audience:unknown,feature:unknown):audience is TutorialAudience {
 return typeof audience==='string' && Object.prototype.hasOwnProperty.call(tutorialCatalogue,audience) && typeof feature==='string' && (feature==='welcome'||tutorialCatalogue[audience as TutorialAudience].features.some(f=>f.id===feature));
}
export async function listVideoSlots():Promise<VideoSlot[]> {
 await ensureTutorialVideos();return (await getDb().query(`SELECT s.audience,s.feature,s.draft_id,s.published_id,s.revision,d.name AS draft_name,p.name AS published_name FROM tutorial_video_slots s LEFT JOIN tutorial_video_files d ON d.id=s.draft_id LEFT JOIN tutorial_video_files p ON p.id=s.published_id`)).rows;
}
export async function publishedTutorialVideos(audience:TutorialAudience):Promise<Record<string,string>> {
 await ensureTutorialVideos();const rows=await getDb().query('SELECT feature,published_id FROM tutorial_video_slots WHERE audience=$1 AND published_id IS NOT NULL',[audience]);
 return Object.fromEntries(rows.rows.map(r=>[r.feature,`/api/tutorial-videos/${r.published_id}`]));
}
export class VideoConflict extends Error {}
export async function saveTutorialVideo(input:{audience:string;feature:string;revision:number;actor:string;action:'upload'|'publish'|'unpublish'|'discard';bytes?:Buffer;name?:string;draftId?:string}) {
 if(!validVideoSlot(input.audience,input.feature)||!Number.isSafeInteger(input.revision)||input.revision<0)throw Error('Choose a valid video slot.');
 const type=input.bytes?tutorialVideoType(input.bytes):null;
 if(input.action==='upload'&&(!input.bytes||!type||input.bytes.length>MAX_TUTORIAL_VIDEO_BYTES))throw Error('Choose an MP4 or WebM video up to 100 MB.');
 await ensureTutorialVideos();const db=await getDb().connect();
 try {await db.query('BEGIN');
  await db.query('INSERT INTO tutorial_video_slots(audience,feature,updated_by) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[input.audience,input.feature,input.actor]);
  const row=(await db.query('SELECT * FROM tutorial_video_slots WHERE audience=$1 AND feature=$2 FOR UPDATE',[input.audience,input.feature])).rows[0];
  if(row.revision!==input.revision)throw new VideoConflict('This video changed in another session. Refresh and try again.');
  let draft=row.draft_id, published=row.published_id;
  if(input.action==='upload') {draft=randomUUID();await db.query('INSERT INTO tutorial_video_files(id,name,content_type,byte_size,data,created_by) VALUES($1,$2,$3,$4,$5,$6)',[draft,(input.name||'Video').slice(0,180),type,input.bytes!.length,input.bytes,input.actor]);}
  else if(input.action==='publish'){if(!draft||draft!==input.draftId)throw new VideoConflict('Preview the current draft before publishing.');published=draft;draft=null;}
  else if(input.action==='unpublish'){draft=draft||published;published=null;}
  else if(input.action==='discard')draft=null;
  else throw Error('Choose a valid action.');
  await db.query('UPDATE tutorial_video_slots SET draft_id=$3,published_id=$4,revision=revision+1,updated_by=$5,updated_at=now() WHERE audience=$1 AND feature=$2',[input.audience,input.feature,draft,published,input.actor]);
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
}
