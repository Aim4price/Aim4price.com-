import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import { getAccountProfile } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import { listAssetRegisters } from "../../lib/asset-registers";
import AssetRegisterClient from "./asset-register-client";
import AssetRegisterWorkspaceFrame from "./asset-register-workspace-frame";
import DealerRegisterGateway from "./dealer-register-gateway";

export const runtime = "nodejs";

function renderWorkspace(children: ReactNode) {
  return (
    <>
      <AppHeader active="asset-register" brandAlignment="working-column" />
      <AssetRegisterWorkspaceFrame>{children}</AssetRegisterWorkspaceFrame>
    </>
  );
}

export default async function AssetRegisterPage({
  searchParams,
}: {
  searchParams?: { dealerView?: string; registerId?: string };
}) {
  const { session } = await requireActivePageAccess();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType === "finance" && profile.accountSubtype === "accountant") {
    redirect("/accountant/registers");
  }

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
      return renderWorkspace(
        <AssetRegisterClient
          showAppHeader={false}
          dealerRegisterMode="dealer"
          registerManagementHref="/asset-registers"
        />,
      );
    }

    if (requestedView === "client" && requestedRegister && requestedRegister.id !== primaryRegister?.id) {
      return renderWorkspace(
        <AssetRegisterClient
          showAppHeader={false}
          dealerRegisterMode="client"
          registerManagementHref="/asset-registers"
        />,
      );
    }

    if (requestedView === "client") {
      redirect("/asset-registers");
    }

    if (requestedRegister) {
      const dealerRegisterMode = requestedRegister.id === primaryRegister?.id ? "dealer" : "client";
      return renderWorkspace(
        <AssetRegisterClient
          showAppHeader={false}
          dealerRegisterMode={dealerRegisterMode}
          registerManagementHref="/asset-registers"
        />,
      );
    }

    return (
      <DealerRegisterGateway
        registers={registers}
      />
    );
  }

  return renderWorkspace(<AssetRegisterClient showAppHeader={false} />);
}
