import AppNotificationDetail from '../../../../../components/AppNotificationDetail';
export const dynamic='force-dynamic';
export default function Detail({params}:{params:{id:string}}) {
  return AppNotificationDetail({ app: 'owner', kind: 'enquiry', id: params.id });
}
