import AppNotificationDetail from '../../../../../components/AppNotificationDetail';
export const dynamic='force-dynamic';
export default function Detail({params}:{params:{id:string}}) {
  return AppNotificationDetail({ app: 'dealer', kind: 'sourcing', id: params.id });
}
