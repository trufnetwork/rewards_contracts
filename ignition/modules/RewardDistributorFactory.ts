import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default  buildModule("RewardDistributorFactoryModule", (m) => {
    const deployer = m.getAccount(1);
    const factory = m.contract("RewardDistributorFactory",
        [m.getParameter("owner", deployer), m.getParameter("imp")],  // if 'owner' not given, use deployer
        {from: deployer}
    );

    return {factory};
});
