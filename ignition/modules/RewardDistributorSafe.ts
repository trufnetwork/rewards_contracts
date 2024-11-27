import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RewardDistributorSafeModule = buildModule("RewardDistributor", (m) => {
    const deployer = m.getAccount(0);
    const rd = m.contract("RewardDistributor",
        [m.getParameter("safe"), m.getParameter("posterFee"), m.getParameter("rewardToken")],
        {from: deployer}
    );
    //
    // const mockToken = m.contractAt("KwilMockToken", m.getParameter("rewardToken"));
    // m.call(mockToken, "transfer", [await rd., amount]);


    return {rd };
});

export default RewardDistributorSafeModule;
