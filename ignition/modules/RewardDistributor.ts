import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RewardDistributorModule = buildModule("RewardDistributor", (m) => {
    const deployer = m.getAccount(0);
    const rd = m.contract("RewardDistributor",
        [m.getParameter("signers"), m.getParameter("threshold"),
            m.getParameter("posterFee"), m.getParameter("rewardToken")],
        {from: deployer}
    );
    //
    // const mockToken = m.contractAt("KwilMockToken", m.getParameter("rewardToken"));
    // m.call(mockToken, "transfer", [await rd., amount]);


    return {rd };
});

export default RewardDistributorModule;
