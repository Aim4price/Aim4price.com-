import { advertStepErrors, type AdvertDetails } from './advert-creator';
import { normalizeAdBrandSnapshot } from './ad-studio';

export function normalizeAdvertPublication(body: unknown) {
  if (!body || typeof body !== 'object') throw new Error('Invalid advert.');
  const input = body as Record<string, unknown>;
  const id = String(input.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid advert reference.');
  const raw = input.details as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') throw new Error('Advert details are required.');
  const text = (key: string, max: number) => String(raw[key] ?? '').trim().slice(0, max);
  const details: AdvertDetails = {
    title: text('title',160), year:text('year',4), usage:text('usage',20),
    usageUnit:text('usageUnit',20) as AdvertDetails['usageUnit'], condition:text('condition',20),
    askingPrice:text('askingPrice',30), vatLabel:text('vatLabel',20) as AdvertDetails['vatLabel'],
    location:'', description:text('description',2000), contactName:text('contactName',160),
    phone:text('phone',80), email:text('email',160), businessName:text('businessName',160),
  };
  if (!['hours','km','percent','none'].includes(details.usageUnit) ||
      !['excellent','good','fair','used','serious'].includes(details.condition) ||
      !['plus-vat','vat-included','no-vat'].includes(details.vatLabel)) throw new Error('Choose valid advert options.');
  const photos = Array.isArray(input.photos) ? [...new Set(input.photos)] : [];
  if (!photos.length || photos.length > 4 || photos.some(url => typeof url !== 'string' || !/^\/api\/asset-register\/uploads\/[a-zA-Z0-9_-]+$/.test(url))) throw new Error('Upload between one and four advert photos.');
  const errors = {...advertStepErrors(details,1),...advertStepErrors(details,2,photos.length)};
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  if (Number(details.askingPrice) > 999999999999) throw new Error('The asking price is too large.');
  const brand = normalizeAdBrandSnapshot(input.brand);
  if (!brand) throw new Error('Choose advert branding.');
  return {id,details,photos:photos as string[],brand:{...brand,vatLabel:details.vatLabel,contactName:details.contactName,phone:details.phone,email:details.email,businessName:details.businessName},
    province:String(input.province ?? '').trim().slice(0,80),area:String(input.area ?? '').trim().slice(0,80)};
}
