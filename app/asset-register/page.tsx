import { getAccountProfile } from '../../lib/account-profile';
import { getAnyServerSession } from '../../lib/auth-session';
import { getManagedTeamActor } from '../../lib/team-login';
import TeamWorkspaceClient from '../team/team-workspace-client';
import AnnualReviewNotice from '../../components/AnnualReviewNotice';
import { redirect } from "next/navigation";
import { requireActivePageAccess } from "../../lib/account-access";
import { listAssetRegisters } from "../../lib/asset-registers";
import AssetRegisterClient from "./asset-register-client";
import AssetRegisterOverview from "./asset-register-overview";
import DealerRegisterGateway from "./dealer-register-gateway";

export const runtime = "nodejs";

export default async function AssetRegisterPage({
  searchParams,
}: {
  searchParams?: { dealerView?: string; registerId?: string };
}) {
  const personal = await getAnyServerSession();
  const managed = personal?.user ? null : await getManagedTeamActor();
  if (managed) return <TeamWorkspaceClient email={managed.username || managed.email} managed initialWorkspace={managed.managedGrantId}/>;
  const { session } = await requireActivePageAccess({allowBusinessWorkspace:true});

  const profile = await getAccountProfile(session.user,{businessToolsFor:session});

  if (profile.accountType !== "owner" && profile.accountType !== "dealer") {
    redirect("/leads");
  }

  if (profile.accountType === "dealer") {
    const registers = await listAssetRegisters(session.user.id);
    const primaryRegister = registers.find((register) => register.isPrimary) ?? registers[0] ?? null;
    const requestedRegisterId = String(searchParams?.registerId ?? "").trim();
    const requestedRegister = registers.find((register) => register.id === requestedRegisterId) ?? null;
    const requestedView = String(searchParams?.dealerView ?? "").trim().toLowerCase();

    if (requestedView === "dealer" && primaryRegister) {
      if (requestedRegister?.id !== primaryRegister.id) {
        redirect(`/asset-register?dealerView=dealer&registerId=${encodeURIComponent(primaryRegister.id)}`);
      }
      return (
        <>
          <AnnualReviewNotice />
          <AssetRegisterClient
            meterBusinessCredits={Boolean(profile.meteredBusiness)}
            dealerRegisterMode="dealer"
            registerManagementHref="/asset-registers"
          />
          <AssetRegisterOverview />
        </>
      );
    }

    if (requestedView === "client" && requestedRegister && requestedRegister.id !== primaryRegister?.id) {
      return (
        <>
          <AnnualReviewNotice />
          <AssetRegisterClient
            meterBusinessCredits={Boolean(profile.meteredBusiness)}
            dealerRegisterMode="client"
            registerManagementHref="/asset-registers"
          />
          <AssetRegisterOverview />
        </>
      );
    }

    if (requestedView === "client") {
      redirect("/asset-registers");
    }

    if (requestedRegister) {
      const dealerRegisterMode = requestedRegister.id === primaryRegister?.id ? "dealer" : "client";
      return (
        <>
          <AnnualReviewNotice />
          <AssetRegisterClient
            meterBusinessCredits={Boolean(profile.meteredBusiness)}
            dealerRegisterMode={dealerRegisterMode}
            registerManagementHref="/asset-registers"
          />
          <AssetRegisterOverview />
        </>
      );
    }

    return (
      <>
        <AnnualReviewNotice />
        <DealerRegisterGateway registers={registers} />
      </>
    );
  }

  return (
    <>
      <AssetRegisterClient />
      <AssetRegisterOverview />
    </>
  );
}
