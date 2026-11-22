import { getDb } from './db';
import { listAssetRegisterItemsForRegisters } from './asset-register-db';

export async function readTrialRegister(userId:string){
  const registers=await getDb().query('select id,business_name from asset_registers where user_id=$1 order by id',[userId]);
  const names=new Map<string,string>(registers.rows.map(r=>[r.id,r.business_name]));
  const assets=await listAssetRegisterItemsForRegisters(userId,Array.from(names.keys()));
  return assets.map(a=>({register:names.get(a.registerId??'')??'',asset:a.title,brand:a.brandName,model:a.modelName,
    year:a.yearModel,serial:a.serialNumber,hours:a.hours,condition:a.condition,valueExVat:a.selectedValueExVat,replacementExVat:a.replacementPriceExVat}));
}
