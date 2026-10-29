import {NextRequest, NextResponse} from 'next/server';
import {getServerSession, isDealerAppSession} from '../../../../lib/auth-session';
import {dealerRoleCan} from '../../../../lib/dealer-app-access';
import {getAccountProfile} from '../../../../lib/account-profile';
import {normalizeAdvertPublication} from '../../../../lib/advert-publication';
import {publishStudioAdvert} from '../../../../lib/marketplace-db';
import {getOrCreateMiddlemanShowroom} from '../../../../lib/middleman-showroom-db';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ok:false,error:'Invalid request origin.'},{status:403});
  const session = await getServerSession({allowDealerApp:true});
  if (!session?.user?.id) return NextResponse.json({ok:false,error:'Sign in to publish.'},{status:401});
  if (isDealerAppSession(session) && (!dealerRoleCan(session.dealerApp.role,'ad_studio') || !dealerRoleCan(session.dealerApp.role,'marketplace'))) return NextResponse.json({ok:false,error:'Your app login cannot publish adverts.'},{status:403});
  const profile = await getAccountProfile({id:session.user.id,name:session.user.name,email:session.user.email});
  if (profile.accountType !== 'dealer' || profile.accountStatus !== 'active') return NextResponse.json({ok:false,error:'Advert publishing is unavailable for this account.'},{status:403});
  let input;
  try { input = normalizeAdvertPublication(await request.json()); }
  catch (error) {return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Check the advert details.'},{status:400});}
  try {
    // Resolve the showroom first. Existing privacy settings remain unchanged.
    const showroom = await getOrCreateMiddlemanShowroom(profile);
    const listing = await publishStudioAdvert(session.user.id,input);
    return NextResponse.json({ok:true,listing,showroomUrl:`/showroom/${showroom.slug}`,showroomPublic:showroom.isPublic});
  } catch (error) {
    console.error('Advert Studio publication failed',error);
    return NextResponse.json({ok:false,error:'Could not publish your advert. Your draft is saved on this page; please try again.'},{status:500});
  }
}
