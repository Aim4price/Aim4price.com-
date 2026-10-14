import { notFound, redirect } from 'next/navigation';
import AppHeader from '../../../components/AppHeader';
import { getAnyServerSession } from '../../../lib/auth-session';
import { canViewTutorialPreview } from '../../../lib/tutorial-preview-access';
import { publishedTutorialVideos } from '../../../lib/tutorial-videos';
import type { TutorialAudience } from '../../../lib/tutorial-catalogue';
import TutorialLibrary from '../tutorial-library';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const metadata={title:'Video guides — private preview',robots:{index:false,follow:false,nocache:true}};
export default async function Page({params}:{params:{audience:string}}){
 if(!['dealers','businesses','sharing'].includes(params.audience))notFound();
 const audience=params.audience as TutorialAudience;
 const session=await getAnyServerSession();
 if(!session?.user?.id)redirect(`/auth?returnTo=${encodeURIComponent(`/tutorials/${audience}`)}#login`);
 if(!canViewTutorialPreview(session.user))notFound();
 return <main><AppHeader active="none"/><TutorialLibrary audience={audience} videos={await publishedTutorialVideos(audience)}/></main>;
}
